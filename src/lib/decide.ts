// Orchestration: an agent's payment request goes through gates, the policy
// engine and the AI guardian, then is executed on PayPal, sent to the owner,
// or blocked. Every step lands on the request's timeline for the audit trail.
import { product as productById } from './catalog';
import { config } from './config';
import { getOwner, getPermit, getRequest, requestsForPermit, saveRequest } from './db';
import { publish } from './events';
import { runGuardian } from './guardian';
import { chargeVault, PayPalError, refundCapture } from './paypal';
import { evaluatePolicy, headline, strictest } from './policy';
import { signReceipt } from './receipts';
import { HttpError } from './session';
import type { Owner, PaymentRequest, Permit, RequestItem, RequestSource, Verdict } from './types';
import { id, money, nowIso, round2, secret } from './util';

export interface PayInput {
  merchant: { name: string; domain: string };
  items: RequestItem[];
  amount?: number;
  task: string;
  agentNote?: string;
  context?: string;
  source: RequestSource;
  scenario?: string;
}

export interface AgentPayResponse {
  request_id: string;
  verdict: Verdict;
  status: PaymentRequest['status'];
  message: string;
  amount: string;
  merchant: string;
  approval?: { expires_at: string; status_url: string };
  paypal?: { order_id?: string; capture_id?: string; env: string };
  receipt?: string;
}

const tl = (r: PaymentRequest, label: string, detail?: string) => r.timeline.push({ at: nowIso(), label, detail });

export function toAgentResponse(r: PaymentRequest): AgentPayResponse {
  const message =
    r.status === 'paid'
      ? `Paid ${money(r.amount)} to ${r.merchant.name} with PayPal.`
      : r.status === 'pending_approval'
        ? `Waiting for the owner to approve: ${r.reason} Poll the status URL.`
        : r.status === 'executing'
          ? 'Approved; PayPal is processing the payment.'
          : r.status === 'blocked'
            ? `Blocked by Valet: ${r.guardian?.agentReason && r.guardian.verdict === 'block' ? r.guardian.agentReason : r.reason} Do not retry this purchase.`
            : r.status === 'declined'
              ? 'The owner declined this purchase. Do not retry it.'
              : r.status === 'expired'
                ? 'The approval window expired. Ask the owner before trying again.'
                : r.status === 'failed'
                  ? `PayPal could not complete the payment: ${r.paypal?.error ?? 'unknown error'}`
                  : `Refunded: ${money(r.paypal?.refundedAmount ?? r.amount)}.`;
  return {
    request_id: r.id,
    verdict: r.verdict,
    status: r.status,
    message,
    amount: r.amount.toFixed(2),
    merchant: r.merchant.name,
    approval: r.status === 'pending_approval' && r.approval ? { expires_at: r.approval.expiresAt, status_url: `${config.appUrl}/api/agent/requests/${r.id}` } : undefined,
    paypal: r.paypal?.orderId ? { order_id: r.paypal.orderId, capture_id: r.paypal.captureId, env: r.paypal.mode } : undefined,
    receipt: r.receipt,
  };
}

function baseRequest(permit: Permit, input: PayInput, amount: number): PaymentRequest {
  return {
    id: id('req', 6),
    ownerId: permit.ownerId,
    permitId: permit.id,
    agentName: permit.agentName,
    source: input.source,
    scenario: input.scenario,
    createdAt: nowIso(),
    merchant: { name: input.merchant.name.slice(0, 80), domain: input.merchant.domain.toLowerCase().slice(0, 120) },
    items: input.items.map((i) => ({ ...i, name: i.name.slice(0, 120) })),
    amount,
    currency: 'USD',
    task: input.task.slice(0, 600),
    agentNote: input.agentNote?.slice(0, 600),
    context: input.context?.slice(0, 4000),
    verdict: 'block',
    status: 'blocked',
    reason: '',
    policy: { checks: [], outcome: 'block', latencyMs: 0 },
    guardian: null,
    decisionMs: 0,
    timeline: [],
  };
}

/** For catalog products, the catalog's name and category win over what the agent claimed. */
export function hydrateItems(items: RequestItem[]): RequestItem[] {
  return items.map((i) => {
    const p = i.sku ? productById(i.sku) : undefined;
    return p ? { ...i, name: p.name, category: p.category } : i;
  });
}

export async function submitPayment(permit: Permit, input: PayInput): Promise<PaymentRequest> {
  const t0 = Date.now();
  const items = hydrateItems(input.items);
  const amount = round2(input.amount ?? items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
  const r = baseRequest(permit, { ...input, items }, amount);
  const owner = getOwner(permit.ownerId);
  tl(r, 'Request received', `${permit.agentName} asked to pay ${money(amount)} at ${r.merchant.name} (${input.source})`);

  // Gates: these stop everything before any analysis runs.
  const gate =
    permit.status === 'revoked'
      ? 'This permit was revoked, so its token no longer works.'
      : permit.status === 'paused'
        ? `${permit.agentName} is paused.`
        : permit.expiresAt && Date.parse(permit.expiresAt) < Date.now()
          ? 'This permit has expired.'
          : !owner
            ? 'The owner account no longer exists.'
            : owner.frozen
              ? 'The owner froze all agents.'
              : !owner.paypal
                ? 'PayPal is not linked yet.'
                : null;
  if (gate) {
    r.policy = { checks: [{ id: 'gate', label: 'Permit status', result: 'block', detail: gate }], outcome: 'block', latencyMs: 0 };
    r.verdict = 'block';
    r.status = 'blocked';
    r.reason = gate;
    r.decisionMs = Date.now() - t0;
    tl(r, 'Blocked at the gate', gate);
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
    return r;
  }

  const history = requestsForPermit(permit.id);
  const policy = evaluatePolicy({ permit, merchant: r.merchant, items, amount, history });
  r.policy = { checks: policy.checks, outcome: policy.outcome, latencyMs: policy.latencyMs };
  tl(r, 'Policy checked', `${policy.outcome.toUpperCase()} in ${policy.latencyMs} ms`);

  const guardian = await runGuardian({ permit, task: r.task, merchant: r.merchant, items, amount, agentNote: r.agentNote, context: r.context, checks: policy.checks, history });
  r.guardian = guardian;
  tl(r, 'Guardian checked intent', `${guardian.verdict.toUpperCase()} (${guardian.mode}, risk ${guardian.riskScore}, ${guardian.latencyMs} ms)${guardian.error ? `; fell back to rules: ${guardian.error}` : ''}`);

  // AI can tighten, never loosen.
  const gVerdict: Verdict = guardian.verdict === 'block' ? 'block' : guardian.verdict === 'escalate' ? 'ask' : 'approve';
  r.verdict = strictest(policy.outcome, gVerdict);
  const policyReason = headline(policy.checks);
  r.reason =
    r.verdict === 'block'
      ? guardian.verdict === 'block'
        ? guardian.ownerExplanation
        : (policyReason ?? guardian.ownerExplanation)
      : r.verdict === 'ask'
        ? (policyReason ?? guardian.ownerExplanation)
        : guardian.ownerExplanation || 'Inside your rules.';
  r.decisionMs = Date.now() - t0;

  if (r.verdict === 'block') {
    r.status = 'blocked';
    tl(r, 'Blocked', r.reason);
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
    return r;
  }

  if (r.verdict === 'ask') {
    r.status = 'pending_approval';
    r.approval = { key: secret(18), requestedAt: nowIso(), expiresAt: new Date(Date.now() + config.approvalTtlMs).toISOString() };
    tl(r, 'Sent to the owner for approval', r.reason);
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
    return r;
  }

  tl(r, 'Approved by your rules', r.reason);
  saveRequest(r);
  return executeRequest(r.id, 'policy');
}

export async function executeRequest(requestId: string, approvedBy: 'policy' | 'owner'): Promise<PaymentRequest> {
  const r = getRequest(requestId);
  if (!r) throw new HttpError(404, 'Request not found');
  const owner = getOwner(r.ownerId);
  const permit = getPermit(r.permitId);
  if (!owner?.paypal || !permit) {
    r.status = 'failed';
    r.paypal = { mode: 'simulated', error: 'PayPal is not linked' };
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
    return r;
  }
  r.status = 'executing';
  r.paypal = { mode: owner.paypal.mode };
  tl(r, 'Charging PayPal', owner.paypal.mode === 'sandbox' ? 'Orders v2 with the vaulted wallet (vault_id)' : 'Simulated PayPal (no sandbox keys configured)');
  saveRequest(r);
  publish(r.ownerId, { type: 'request', request: r });

  try {
    const res = await chargeVault({
      requestId: r.id,
      vaultId: owner.paypal.paymentTokenId,
      mode: owner.paypal.mode,
      merchantName: r.merchant.name,
      items: r.items.map((i) => ({ name: i.name, sku: i.sku, unitPrice: i.unitPrice, quantity: i.quantity, digital: i.category === 'gift_cards' || i.category === 'digital_goods' })),
    });
    r.paypal = { mode: owner.paypal.mode, orderId: res.orderId, captureId: res.captureId, status: res.status, debugId: res.debugId };
    if (res.status === 'COMPLETED') {
      r.status = 'paid';
      r.receipt = await signReceipt(r, permit, approvedBy);
      tl(r, 'Paid with PayPal', `Order ${res.orderId}, capture ${res.captureId ?? 'pending'}`);
    } else if (res.payerActionUrl) {
      r.status = 'failed';
      r.paypal.error = 'PayPal asked the owner to re-approve this wallet';
      tl(r, 'PayPal needs the owner', res.payerActionUrl);
    } else {
      r.status = 'failed';
      r.paypal.error = `Order status ${res.status}`;
      tl(r, 'PayPal did not complete', res.status);
    }
  } catch (err) {
    r.status = 'failed';
    r.paypal = {
      mode: owner.paypal.mode,
      error: err instanceof Error ? err.message : String(err),
      debugId: err instanceof PayPalError ? err.debugId : undefined,
    };
    tl(r, 'PayPal error', r.paypal.error);
  }
  saveRequest(r);
  publish(r.ownerId, { type: 'request', request: r });
  return r;
}

/** Lazily expires approvals that were never answered. */
export function expireIfStale(r: PaymentRequest): PaymentRequest {
  if (r.status === 'pending_approval' && r.approval && Date.parse(r.approval.expiresAt) < Date.now()) {
    r.status = 'expired';
    tl(r, 'Approval expired', 'No answer within 10 minutes; nothing was charged.');
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
  }
  return r;
}

export async function decide(owner: Owner | null, requestId: string, decision: 'approve' | 'decline', via: 'web' | 'phone', key?: string): Promise<PaymentRequest> {
  const r = getRequest(requestId);
  if (!r) throw new HttpError(404, 'Request not found');
  const authorized = (owner && owner.id === r.ownerId) || (key && r.approval?.key === key);
  if (!authorized) throw new HttpError(403, 'Only the account owner can decide this request.');
  expireIfStale(r);
  if (r.status !== 'pending_approval' || !r.approval) throw new HttpError(409, `This request is already ${r.status.replace('_', ' ')}.`);
  r.approval.decidedAt = nowIso();
  r.approval.decision = decision === 'approve' ? 'approved' : 'declined';
  r.approval.via = via;
  if (decision === 'decline') {
    r.status = 'declined';
    tl(r, 'Declined by the owner', via === 'phone' ? 'From the phone approval card' : 'From the dashboard');
    saveRequest(r);
    publish(r.ownerId, { type: 'request', request: r });
    return r;
  }
  r.verdict = 'approve';
  tl(r, 'Approved by the owner', via === 'phone' ? 'One tap on the phone' : 'One tap in the dashboard');
  saveRequest(r);
  return executeRequest(r.id, 'owner');
}

export async function refund(owner: Owner, requestId: string, amount?: number): Promise<PaymentRequest> {
  const r = getRequest(requestId);
  if (!r || r.ownerId !== owner.id) throw new HttpError(404, 'Purchase not found');
  if (!['paid', 'partially_refunded'].includes(r.status) || !r.paypal?.captureId) throw new HttpError(409, 'Only paid purchases can be refunded.');
  const already = r.paypal.refundedAmount ?? 0;
  const remaining = round2(r.amount - already);
  const value = amount ? Math.min(round2(amount), remaining) : remaining;
  if (value <= 0) throw new HttpError(409, 'Nothing left to refund.');
  const res = await refundCapture({ captureId: r.paypal.captureId, amount: value < r.amount ? value : undefined, requestId: r.id, mode: r.paypal.mode });
  r.paypal.refundId = res.refundId;
  r.paypal.refundStatus = res.status;
  r.paypal.refundedAmount = round2(already + value);
  r.status = r.paypal.refundedAmount >= r.amount - 0.001 ? 'refunded' : 'partially_refunded';
  tl(r, 'Refunded through PayPal', `${money(value)} (refund ${res.refundId}, ${res.status})`);
  saveRequest(r);
  publish(r.ownerId, { type: 'request', request: r });
  return r;
}

/** Evidence bundle for a dispute or a "my agent got it wrong" claim. */
export function evidence(r: PaymentRequest, permit: Permit | undefined) {
  return {
    generated_at: nowIso(),
    summary: `${r.agentName} requested ${money(r.amount)} at ${r.merchant.name} for the task "${r.task}". Decision: ${r.verdict}. Status: ${r.status}.`,
    request: {
      id: r.id,
      created_at: r.createdAt,
      merchant: r.merchant,
      items: r.items,
      amount: r.amount,
      task: r.task,
      agent_note: r.agentNote,
      merchant_page_excerpt: r.context,
    },
    permit: permit ? { id: permit.id, owner_sentence: permit.sentence, rules: permit.rules, status: permit.status } : null,
    policy_checks: r.policy.checks,
    guardian: r.guardian,
    approval: r.approval ? { requested_at: r.approval.requestedAt, decided_at: r.approval.decidedAt, decision: r.approval.decision, via: r.approval.via } : null,
    paypal: r.paypal,
    signed_receipt: r.receipt ?? null,
    timeline: r.timeline,
  };
}
