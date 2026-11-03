// The owner's concierge: Claude with PayPal's official Agent Toolkit, limited to
// read and refund. Least privilege by design: it can fix mistakes, never spend.
import type Anthropic from '@anthropic-ai/sdk';
import { claudeClient, FALLBACK, MODEL } from './claude';
import { aiMode, config, paypalMode } from './config';
import { findRequestByPayPal, getPermit, getRequest, requestsFor, saveRequest } from './db';
import { evidence, refund } from './decide';
import { publish } from './events';
import type { Owner } from './types';
import { money, nowIso, round2 } from './util';

export type ConciergeEvent = { type: 'assistant'; text: string } | { type: 'tool'; label: string; detail?: string; source: 'paypal-agent-toolkit' | 'valet' } | { type: 'done' } | { type: 'error'; message: string };

type ToolkitLike = {
  getTools(): { type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }[];
  handleToolCall(call: { id: string; type: 'function'; function: { name: string; arguments: string } }): Promise<{ content: unknown }>;
};

type G = typeof globalThis & { __ppToolkit?: Promise<ToolkitLike | null> };
const g = globalThis as G;

/** PayPal Agent Toolkit, scoped to the actions the concierge needs and nothing else. */
async function toolkit(): Promise<ToolkitLike | null> {
  if (paypalMode() !== 'sandbox') return null;
  if (!g.__ppToolkit) {
    g.__ppToolkit = import('@paypal/agent-toolkit/openai')
      .then(({ PayPalAgentToolkit }) =>
        new PayPalAgentToolkit({
          clientId: config.paypal.clientId,
          clientSecret: config.paypal.clientSecret,
          configuration: {
            actions: {
              orders: { get: true },
              payments: { createRefund: true, getRefunds: true },
              transactions: { list: true },
              disputes: { list: true, get: true },
            },
            context: { sandbox: true },
          },
        }) as unknown as ToolkitLike,
      )
      .catch((err) => {
        console.error('[valet] PayPal Agent Toolkit failed to load', err);
        return null;
      });
  }
  return g.__ppToolkit;
}

function purchases(owner: Owner) {
  return requestsFor(owner.id)
    .filter((r) => ['paid', 'refunded', 'partially_refunded', 'blocked', 'pending_approval', 'declined'].includes(r.status))
    .slice(0, 25)
    .map((r) => ({
      request_id: r.id,
      when: r.createdAt,
      agent: r.agentName,
      merchant: r.merchant.name,
      items: r.items.map((i) => `${i.quantity} x ${i.name}`).join(', '),
      amount: r.amount,
      status: r.status,
      decision_reason: r.reason,
      paypal_order_id: r.paypal?.orderId,
      paypal_capture_id: r.paypal?.captureId,
      refunded: r.paypal?.refundedAmount ?? 0,
    }));
}

const VALET_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'list_agent_purchases',
    description: "List the owner's recent agent purchases and decisions from Valet's ledger, with PayPal order and capture ids.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_evidence_bundle',
    description: 'Get the full decision trail for one request: permit, policy checks, guardian verdict, approvals, PayPal ids.',
    input_schema: { type: 'object', properties: { request_id: { type: 'string' } }, required: ['request_id'] },
  },
];

const VALET_REFUND_TOOL: Anthropic.Beta.BetaTool = {
  name: 'refund_purchase',
  description: 'Refund a paid agent purchase through PayPal. Omit amount for a full refund.',
  input_schema: { type: 'object', properties: { request_id: { type: 'string' }, amount: { type: 'number' } }, required: ['request_id'] },
};

const SYSTEM = `You are the Valet concierge for the account owner. Valet lets the owner's AI agents pay with PayPal inside rules the owner wrote.
You help the owner understand and fix what their agents bought. You can read the ledger, read PayPal orders, transactions and disputes, and issue refunds.
You can never make a purchase.
Before any refund, state the purchase, merchant and amount in one sentence and ask the owner to confirm. Only call a refund tool after the owner replies yes in this conversation.
Use the capture id from the ledger for PayPal refunds. Keep answers to three sentences or fewer, in plain words, with dollar amounts.`;

export async function runConcierge(owner: Owner, history: { role: 'user' | 'assistant'; text: string }[], emit: (e: ConciergeEvent) => void) {
  if (aiMode() !== 'claude') {
    emit({ type: 'assistant', text: offlineAnswer(owner, history[history.length - 1]?.text ?? '') });
    emit({ type: 'done' });
    return;
  }
  const client = claudeClient()!;
  const kit = await toolkit();
  const kitTools: Anthropic.Beta.BetaTool[] = kit
    ? kit.getTools().map((t) => ({
        name: t.function.name,
        description: `[PayPal Agent Toolkit] ${t.function.description ?? ''}`.slice(0, 1000),
        input_schema: { type: 'object', ...(stripSchema(t.function.parameters) as object) } as Anthropic.Beta.BetaTool.InputSchema,
      }))
    : [];
  const tools = [...VALET_TOOLS, ...(kit ? kitTools : [VALET_REFUND_TOOL])];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((h) => ({ role: h.role, content: h.text }));

  try {
    for (let turn = 0; turn < 6; turn++) {
      const res = await client.beta.messages.create({ model: MODEL, max_tokens: 4000, system: SYSTEM, tools, messages, output_config: { effort: 'low' }, ...FALLBACK });
      for (const b of res.content) if (b.type === 'text' && b.text.trim()) emit({ type: 'assistant', text: b.text.trim() });
      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) break;
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        const input = (call.input ?? {}) as Record<string, unknown>;
        let content: string;
        try {
          content = await runTool(owner, kit, call.id, call.name, input, emit);
        } catch (err) {
          content = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
        results.push({ type: 'tool_result', tool_use_id: call.id, content: content.slice(0, 12000) });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
  emit({ type: 'done' });
}

function stripSchema(s: Record<string, unknown> | undefined) {
  if (!s) return { properties: {} };
  const { $schema: _s, definitions: _d, ...rest } = s as Record<string, unknown>;
  return rest;
}

async function runTool(owner: Owner, kit: ToolkitLike | null, id: string, name: string, input: Record<string, unknown>, emit: (e: ConciergeEvent) => void): Promise<string> {
  if (name === 'list_agent_purchases') {
    emit({ type: 'tool', label: 'Read the Valet ledger', source: 'valet' });
    return JSON.stringify(purchases(owner));
  }
  if (name === 'get_evidence_bundle') {
    const r = getRequest(String(input.request_id ?? ''));
    if (!r || r.ownerId !== owner.id) return JSON.stringify({ error: 'not found' });
    emit({ type: 'tool', label: 'Pulled the evidence bundle', detail: r.id, source: 'valet' });
    return JSON.stringify(evidence(r, getPermit(r.permitId)));
  }
  if (name === 'refund_purchase') {
    const r = await refund(owner, String(input.request_id ?? ''), typeof input.amount === 'number' ? input.amount : undefined);
    emit({ type: 'tool', label: 'Refunded through PayPal', detail: `${money(r.paypal?.refundedAmount ?? 0)} · ${r.merchant.name}`, source: 'valet' });
    return JSON.stringify({ status: r.status, refunded: r.paypal?.refundedAmount, refund_id: r.paypal?.refundId });
  }
  if (!kit) return JSON.stringify({ error: 'PayPal Agent Toolkit unavailable' });

  // Ownership guard: the toolkit acts on the merchant account, so only let it
  // touch PayPal objects that belong to this owner's agent purchases.
  const ref = { orderId: typeof input.id === 'string' ? input.id : undefined, captureId: typeof input.capture_id === 'string' ? input.capture_id : undefined };
  const linked = ref.orderId || ref.captureId ? findRequestByPayPal(ref) : undefined;
  if ((ref.orderId || ref.captureId) && linked?.ownerId !== owner.id) return JSON.stringify({ error: 'That PayPal object is not one of your agent purchases.' });

  const labels: Record<string, string> = {
    get_order: 'Read the PayPal order',
    create_refund: 'Refunded with PayPal Agent Toolkit',
    get_refund: 'Checked the PayPal refund',
    list_transactions: 'Listed PayPal transactions',
    list_disputes: 'Listed PayPal disputes',
    get_dispute: 'Read the PayPal dispute',
  };
  const out = await kit.handleToolCall({ id, type: 'function', function: { name, arguments: JSON.stringify(input) } });
  const content = typeof out.content === 'string' ? out.content : JSON.stringify(out.content);
  emit({ type: 'tool', label: labels[name] ?? name, detail: linked ? `${linked.merchant.name} · ${money(linked.amount)}` : undefined, source: 'paypal-agent-toolkit' });

  // Keep Valet's ledger in sync when the toolkit issues a refund.
  if (name === 'create_refund' && linked) {
    try {
      const parsed = JSON.parse(content) as { id?: string; status?: string; amount?: { value?: string } };
      if (parsed.id) {
        const value = parsed.amount?.value ? Number(parsed.amount.value) : linked.amount - (linked.paypal?.refundedAmount ?? 0);
        linked.paypal = { ...linked.paypal!, refundId: parsed.id, refundStatus: parsed.status, refundedAmount: round2((linked.paypal?.refundedAmount ?? 0) + value) };
        linked.status = linked.paypal.refundedAmount! >= linked.amount - 0.001 ? 'refunded' : 'partially_refunded';
        linked.timeline.push({ at: nowIso(), label: 'Refunded by the concierge (PayPal Agent Toolkit)', detail: `${money(value)}, refund ${parsed.id}` });
        saveRequest(linked);
        publish(owner.id, { type: 'request', request: linked });
      }
    } catch {
      /* toolkit returned a non-JSON error string; surfaced to Claude as-is */
    }
  }
  return content;
}

function offlineAnswer(owner: Owner, q: string) {
  const list = requestsFor(owner.id);
  const paid = list.filter((r) => r.status === 'paid');
  const blocked = list.filter((r) => r.status === 'blocked');
  const total = round2(paid.reduce((s, r) => s + r.amount, 0));
  if (/block|stop|attack/i.test(q)) {
    return blocked.length ? `Valet blocked ${blocked.length} request${blocked.length > 1 ? 's' : ''}. Latest: ${blocked[0].merchant.name}, ${money(blocked[0].amount)}: ${blocked[0].reason}` : 'Nothing has been blocked yet.';
  }
  return paid.length
    ? `Your agents paid ${money(total)} across ${paid.length} purchase${paid.length > 1 ? 's' : ''}. Most recent: ${paid[0].merchant.name}, ${money(paid[0].amount)}. To refund one, use the Refund button in Activity (add an Anthropic key to do it by chat).`
    : 'No agent purchases yet. Run the demo agent to see some.';
}
