// Deterministic policy engine. Runs before any AI, in microseconds, and is the
// only thing that can approve a payment on its own. Pure function: easy to test.
import { STORES } from './catalog';
import { CATEGORY_LABEL, type PaymentRequest, type Permit, type PolicyCheck, type RequestItem, type Verdict } from './types';
import { domainRoot, editDistance, money, round2, skeleton } from './util';

export interface PolicyInput {
  permit: Permit;
  merchant: { name: string; domain: string };
  items: RequestItem[];
  amount: number;
  history: PaymentRequest[];
  now?: number;
}

export interface PolicyResult {
  checks: PolicyCheck[];
  outcome: Verdict;
  latencyMs: number;
  spentInPeriod: number;
}

const PERIOD_MS = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5 } as const;
const PERIOD_WORD = { day: 'today', week: 'this week', month: 'this month' } as const;
const COUNTS_AS_SPEND = new Set(['paid', 'executing', 'partially_refunded']);

/**
 * What a permit has spent, net of refunds: within the budget's period when it
 * has one, otherwise in total. Every screen and API that shows spend uses this,
 * so it always matches what the budget check counts.
 */
export function spentOn(history: PaymentRequest[], budget: Permit['rules']['budget'], now = Date.now()): number {
  const windowMs = budget ? PERIOD_MS[budget.period] : Infinity;
  return round2(
    history.filter((h) => COUNTS_AS_SPEND.has(h.status) && now - Date.parse(h.createdAt) < windowMs).reduce((s, h) => s + h.amount - (h.paypal?.refundedAmount ?? 0), 0),
  );
}
const COUNTS_AS_ATTEMPT = new Set(['paid', 'executing', 'pending_approval', 'partially_refunded']);

const severity: Record<PolicyCheck['result'], number> = { pass: 0, info: 0, ask: 1, block: 2 };

export function strictest(a: Verdict, b: Verdict): Verdict {
  const rank: Record<Verdict, number> = { approve: 0, ask: 1, block: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function matchesMerchant(list: string[], m: { name: string; domain: string }) {
  const name = m.name.toLowerCase();
  const domain = m.domain.toLowerCase();
  return list.some((entry) => {
    const e = entry.toLowerCase().trim();
    return e && (name.includes(e) || domain.includes(e) || e.includes(domainRoot(domain)));
  });
}

/** Flags merchants whose name or domain imitates a trusted store or one the owner already uses. */
export function lookalikeOf(m: { name: string; domain: string }, knownDomains: string[]): string | null {
  const d = m.domain.toLowerCase().replace(/^www\./, '');
  const candidates = Array.from(new Set([...STORES.filter((s) => s.trusted).map((s) => s.domain), ...knownDomains]));
  if (candidates.includes(d)) return null;
  const sk = skeleton(domainRoot(d));
  for (const known of candidates) {
    const ks = skeleton(domainRoot(known));
    if (ks.length < 5) continue;
    const close = editDistance(sk, ks) <= 2;
    const embeds = sk !== ks && (sk.includes(ks) || (ks.includes(sk) && sk.length > 5));
    const homoglyph = sk === ks;
    if (close || embeds || homoglyph) return known;
  }
  return null;
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const t0 = performance.now();
  const now = input.now ?? Date.now();
  const { permit, merchant, items, amount, history } = input;
  const r = permit.rules;
  const checks: PolicyCheck[] = [];
  const add = (c: PolicyCheck) => checks.push(c);

  // 1. Integrity: the amount must equal the items the agent listed.
  const itemsTotal = round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
  if (Math.abs(itemsTotal - amount) > 0.01) {
    add({ id: 'amount_integrity', label: 'Amount matches items', result: 'block', detail: `Charge of ${money(amount)} does not match the items (${money(itemsTotal)}).` });
  } else {
    add({ id: 'amount_integrity', label: 'Amount matches items', result: 'pass', detail: `${money(amount)} for ${items.length} item${items.length === 1 ? '' : 's'}.` });
  }

  // 2. Never-lists: blocked categories and merchants.
  const blockedItems = items.filter((i) => r.blockedCategories.includes(i.category));
  if (blockedItems.length) {
    const cats = Array.from(new Set(blockedItems.map((i) => CATEGORY_LABEL[i.category].toLowerCase())));
    add({ id: 'blocked_category', label: 'Never-list', result: 'block', detail: `Your permit says never ${cats.join(' or ')}.` });
  } else {
    add({ id: 'blocked_category', label: 'Never-list', result: 'pass', detail: 'No blocked categories.' });
  }
  if (r.blockedMerchants.length && matchesMerchant(r.blockedMerchants, merchant)) {
    add({ id: 'blocked_merchant', label: 'Blocked merchant', result: 'block', detail: `${merchant.name} is on your never-list.` });
  }

  // 3. Hard per-purchase cap.
  if (r.perPurchaseMax !== null && amount > r.perPurchaseMax) {
    add({ id: 'per_purchase_max', label: 'Per-purchase cap', result: 'block', detail: `${money(amount)} is over your ${money(r.perPurchaseMax)} cap for a single purchase.` });
  }

  // 4. Burst protection.
  if (r.maxPurchasesPerHour !== null) {
    const lastHour = history.filter((h) => COUNTS_AS_ATTEMPT.has(h.status) && now - Date.parse(h.createdAt) < 36e5).length;
    if (lastHour >= r.maxPurchasesPerHour) {
      add({ id: 'velocity', label: 'Burst limit', result: 'block', detail: `${lastHour} purchases in the last hour; your limit is ${r.maxPurchasesPerHour}.` });
    } else {
      add({ id: 'velocity', label: 'Burst limit', result: 'pass', detail: `${lastHour} of ${r.maxPurchasesPerHour} purchases this hour.` });
    }
  }

  // 5. Scope: categories and merchants the owner did not mention.
  if (r.allowedCategories?.length) {
    const outside = items.filter((i) => !r.allowedCategories!.includes(i.category) && !r.blockedCategories.includes(i.category));
    if (outside.length) {
      const cats = Array.from(new Set(outside.map((i) => CATEGORY_LABEL[i.category].toLowerCase())));
      const list = cats.join(', ');
      add({ id: 'category_scope', label: 'Category scope', result: 'ask', detail: `${list[0].toUpperCase()}${list.slice(1)} ${cats.length > 1 ? 'are' : 'is'} outside what this permit covers.` });
    } else {
      add({ id: 'category_scope', label: 'Category scope', result: 'pass', detail: 'Every item is in scope.' });
    }
  }
  if (r.allowedMerchants?.length && !matchesMerchant(r.allowedMerchants, merchant)) {
    add({ id: 'merchant_scope', label: 'Merchant scope', result: 'ask', detail: `${merchant.name} is not one of your listed stores.` });
  }

  // 6. Lookalike merchants.
  const knownDomains = Array.from(new Set(history.filter((h) => h.status === 'paid').map((h) => h.merchant.domain)));
  const imitated = lookalikeOf(merchant, knownDomains);
  if (imitated) {
    add({ id: 'lookalike', label: 'Lookalike merchant', result: 'ask', detail: `${merchant.domain} imitates ${imitated}.` });
  }

  // 7. Budget for the period.
  let spentInPeriod = 0;
  if (r.budget) {
    spentInPeriod = spentOn(history, r.budget, now);
    const after = round2(spentInPeriod + amount);
    if (after > r.budget.amount) {
      add({ id: 'budget', label: 'Budget', result: 'ask', detail: `This would make ${money(after)} ${PERIOD_WORD[r.budget.period]}, over your ${money(r.budget.amount)} limit.` });
    } else {
      add({ id: 'budget', label: 'Budget', result: 'pass', detail: `${money(after)} of ${money(r.budget.amount)} ${PERIOD_WORD[r.budget.period]}.` });
    }
  }

  // 8. Duplicate guard.
  const dup = history.find(
    (h) => COUNTS_AS_ATTEMPT.has(h.status) && h.merchant.domain === merchant.domain && Math.abs(h.amount - amount) < 0.01 && now - Date.parse(h.createdAt) < 10 * 6e4,
  );
  if (dup) add({ id: 'duplicate', label: 'Duplicate', result: 'ask', detail: `Same amount at ${merchant.name} less than 10 minutes ago.` });

  // 9. Auto-approve threshold.
  if (r.autoApproveUpTo !== null) {
    if (amount > r.autoApproveUpTo) {
      add({ id: 'auto_approve', label: 'Approval threshold', result: 'ask', detail: `${money(amount)} is above your ${money(r.autoApproveUpTo)} auto-approve limit.` });
    } else {
      add({ id: 'auto_approve', label: 'Approval threshold', result: 'pass', detail: `Under your ${money(r.autoApproveUpTo)} auto-approve limit.` });
    }
  }

  const worst = checks.reduce((acc, c) => Math.max(acc, severity[c.result]), 0);
  const outcome: Verdict = worst === 2 ? 'block' : worst === 1 ? 'ask' : 'approve';
  return { checks, outcome, latencyMs: Math.round((performance.now() - t0) * 100) / 100, spentInPeriod };
}

/** The headline reason the owner sees: the first blocking check, else the first ask. */
export function headline(checks: PolicyCheck[]): string | null {
  return checks.find((c) => c.result === 'block')?.detail ?? checks.find((c) => c.result === 'ask')?.detail ?? null;
}
