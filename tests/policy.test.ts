import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, lookalikeOf, strictest } from '../src/lib/policy';
import { compileRulesOffline, normalizeRules } from '../src/lib/permits';
import { rulesGuardian } from '../src/lib/guardian';
import { INJECTION_TEXT } from '../src/lib/catalog';
import type { PaymentRequest, Permit, PermitRules, RequestItem } from '../src/lib/types';

const rules: PermitRules = normalizeRules({
  purpose: 'Weekly house shopping',
  budget: { amount: 250, period: 'week' },
  perPurchaseMax: 500,
  autoApproveUpTo: 75,
  allowedCategories: ['groceries', 'household', 'outdoor'],
  blockedCategories: ['gift_cards', 'crypto', 'cash_equivalents', 'gambling'],
  allowedMerchants: null,
  blockedMerchants: ['shadyshop'],
  maxPurchasesPerHour: 3,
  expiresInDays: 30,
  notes: [],
});

const permit: Permit = {
  id: 'pmt_test',
  ownerId: 'own_test',
  agentName: 'Scout',
  agentKind: 'demo',
  sentence: 'Weekly house shopping up to $250 a week, ask me over $75, never gift cards',
  rules,
  compiledBy: 'rules',
  tokenHash: 'x',
  tokenPreview: 'vlt_sb_…',
  status: 'active',
  createdAt: new Date().toISOString(),
  expiresAt: null,
};

const freshcart = { name: 'FreshCart', domain: 'freshcart.com' };
const item = (over: Partial<RequestItem> = {}): RequestItem => ({ name: 'Weekly produce box', sku: 'fc-produce', category: 'groceries', unitPrice: 32, quantity: 1, ...over });

function past(over: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: `req_${Math.random()}`,
    ownerId: 'own_test',
    permitId: 'pmt_test',
    agentName: 'Scout',
    source: 'rest',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    merchant: freshcart,
    items: [item()],
    amount: 32,
    currency: 'USD',
    task: 'groceries',
    verdict: 'approve',
    status: 'paid',
    reason: '',
    policy: { checks: [], outcome: 'approve', latencyMs: 0 },
    guardian: null,
    decisionMs: 0,
    timeline: [],
    ...over,
  };
}

const run = (items: RequestItem[], merchant = freshcart, history: PaymentRequest[] = []) =>
  evaluatePolicy({ permit, merchant, items, amount: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), history });

test('approves an in-scope purchase under the threshold', () => {
  assert.equal(run([item()]).outcome, 'approve');
});

test('asks the owner above the auto-approve threshold', () => {
  const r = run([item({ name: 'Ridgeline 2-person tent', sku: 'th-tent2', category: 'outdoor', unitPrice: 129 })], { name: 'Trailhead Outfitters', domain: 'trailheadoutfitters.com' });
  assert.equal(r.outcome, 'ask');
  assert.ok(r.checks.some((c) => c.id === 'auto_approve' && c.result === 'ask'));
});

test('blocks never-list categories', () => {
  assert.equal(run([item({ name: 'Gift card', sku: undefined, category: 'gift_cards', unitPrice: 50 })]).outcome, 'block');
});

test('blocks blocked merchants', () => {
  assert.equal(run([item()], { name: 'ShadyShop', domain: 'shadyshop.biz' }).outcome, 'block');
});

test('blocks an amount that does not match the items', () => {
  const r = evaluatePolicy({ permit, merchant: freshcart, items: [item()], amount: 320, history: [] });
  assert.equal(r.outcome, 'block');
  assert.ok(r.checks.some((c) => c.id === 'amount_integrity' && c.result === 'block'));
});

test('blocks above the per-purchase cap', () => {
  assert.equal(run([item({ category: 'outdoor', unitPrice: 1290 })]).outcome, 'block');
});

test('asks for categories outside the permit scope', () => {
  const r = run([item({ name: 'USB-C cable', category: 'electronics', unitPrice: 12 })], { name: 'VoltBay', domain: 'voltbay.com' });
  assert.equal(r.outcome, 'ask');
  assert.ok(r.checks.some((c) => c.id === 'category_scope' && c.result === 'ask'));
});

test('detects lookalike merchants', () => {
  assert.equal(lookalikeOf({ name: 'Trai1head', domain: 'trai1headoutfitters.co' }, []), 'trailheadoutfitters.com');
  assert.equal(lookalikeOf({ name: 'TrailDeals', domain: 'trai1headoutfitters-deals.shop' }, []), 'trailheadoutfitters.com');
  assert.equal(lookalikeOf({ name: 'FreshCart', domain: 'freshcart.com' }, []), null);
  assert.equal(lookalikeOf({ name: 'Bookshop', domain: 'bookshop.org' }, []), null);
});

test('blocks a burst beyond the hourly limit', () => {
  const history = [past({}), past({ amount: 6 }), past({ amount: 9 })];
  const r = run([item({ unitPrice: 13.5 })], freshcart, history);
  assert.equal(r.outcome, 'block');
  assert.ok(r.checks.some((c) => c.id === 'velocity' && c.result === 'block'));
});

test('asks when the weekly budget would be exceeded', () => {
  const history = [past({ amount: 240, createdAt: new Date(Date.now() - 2 * 36e5).toISOString() })];
  const r = run([item({ unitPrice: 20 })], freshcart, history);
  assert.equal(r.outcome, 'ask');
  assert.ok(r.checks.some((c) => c.id === 'budget' && c.result === 'ask'));
});

test('budget ignores spend outside the window and refunded amounts', () => {
  const history = [past({ amount: 240, createdAt: new Date(Date.now() - 9 * 864e5).toISOString() }), past({ amount: 200, createdAt: new Date(Date.now() - 2 * 36e5).toISOString(), status: 'refunded' })];
  assert.equal(run([item({ unitPrice: 20 })], freshcart, history).outcome, 'approve');
});

test('asks on a duplicate within ten minutes', () => {
  const r = run([item()], freshcart, [past({ amount: 32 })]);
  assert.ok(r.checks.some((c) => c.id === 'duplicate' && c.result === 'ask'));
});

test('strictest keeps the harsher verdict', () => {
  assert.equal(strictest('approve', 'ask'), 'ask');
  assert.equal(strictest('block', 'approve'), 'block');
  assert.equal(strictest('ask', 'block'), 'block');
});

test('offline compiler reads the demo sentence', () => {
  const r = compileRulesOffline('Weekly house shopping: groceries, household supplies and outdoor gear, up to $250 a week. Ask me for anything over $75. Never gift cards or crypto.');
  assert.deepEqual(r.budget, { amount: 250, period: 'week' });
  assert.equal(r.autoApproveUpTo, 75);
  assert.ok(r.allowedCategories?.includes('groceries') && r.allowedCategories.includes('outdoor'));
  assert.ok(r.blockedCategories.includes('gift_cards') && r.blockedCategories.includes('crypto'));
  assert.ok(!r.allowedCategories?.includes('gift_cards'));
});

test('offline compiler reads caps and always-ask', () => {
  const r = compileRulesOffline('Book my work travel up to $1,200 a month. Always ask me before paying. Never more than $600 at once.');
  assert.deepEqual(r.budget, { amount: 1200, period: 'month' });
  assert.equal(r.autoApproveUpTo, 0);
  assert.equal(r.perPurchaseMax, 600);
  assert.ok(r.allowedCategories?.includes('travel'));
});

const g = (over: Partial<Parameters<typeof rulesGuardian>[0]> = {}) =>
  rulesGuardian({ permit, task: 'Restock the house for the week', merchant: freshcart, items: [item()], amount: 32, checks: [], history: [], ...over });

test('guardian allows a clean, on-task purchase', () => {
  assert.equal(g().verdict, 'allow');
});

test('guardian blocks prompt injection from a merchant page', () => {
  const r = g({ task: 'Buy a 2-person tent', merchant: { name: 'TrailDeals Outlet', domain: 'trai1headoutfitters-deals.shop' }, items: [item({ name: 'Gift card', sku: 'td-gift-100', category: 'gift_cards', unitPrice: 100, quantity: 3 })], amount: 300, context: INJECTION_TEXT });
  assert.equal(r.verdict, 'block');
  assert.ok(r.signals.includes('prompt_injection'));
});

test('guardian blocks tampered catalog prices', () => {
  const r = g({ task: 'Buy a 2-person tent', merchant: { name: 'Trailhead Outfitters', domain: 'trailheadoutfitters.com' }, items: [item({ name: 'Ridgeline 2-person tent', sku: 'th-tent2', category: 'outdoor', unitPrice: 1290 })], amount: 1290 });
  assert.equal(r.verdict, 'block');
  assert.ok(r.signals.includes('price_anomaly'));
});

test('guardian escalates off-task items', () => {
  const r = g({ items: [item({ name: '65 in OLED TV', sku: 'vb-tv65', category: 'electronics', unitPrice: 899 })], amount: 899, merchant: { name: 'VoltBay', domain: 'voltbay.com' } });
  assert.equal(r.verdict, 'escalate');
  assert.ok(r.signals.includes('task_mismatch'));
});
