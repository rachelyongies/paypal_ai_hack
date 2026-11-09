// "Scout", the demo shopping agent. It exists to prove the rails: it shops the
// demo stores and pays only through Valet, exactly as a third-party agent would.
import type Anthropic from '@anthropic-ai/sdk';
import { pageText, product, searchProducts, store } from './catalog';
import { claudeClient, FALLBACK, MODEL } from './claude';
import { aiMode } from './config';
import { getRequest, requestsForPermit } from './db';
import { expireIfStale, submitPayment, toAgentResponse, type AgentPayResponse } from './decide';
import { ruleChips } from './rules-text';
import type { Permit } from './types';
import { money, sleep } from './util';

export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'tool'; name: string; label: string; detail?: string }
  | { type: 'payment'; result: AgentPayResponse }
  | { type: 'done'; mode: 'claude' | 'scripted' }
  | { type: 'error'; message: string };

export interface AgentRun {
  permit: Permit;
  task: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  compromised: boolean;
  emit: (e: AgentEvent) => void;
}

function permitSummary(p: Permit) {
  const spent = requestsForPermit(p.id)
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + r.amount, 0);
  return {
    agent: p.agentName,
    purpose: p.rules.purpose,
    status: p.status,
    rules: ruleChips(p.rules).map((c) => c.label),
    spent_so_far: money(spent),
  };
}

// ---------------------------------------------------------------------------
// Tool implementations shared by both modes.
function toolSearch(query: string) {
  return searchProducts(query).map((p) => ({ product_id: p.id, name: p.name, price: p.price, store: store(p.store)!.name, domain: store(p.store)!.domain }));
}

async function toolPay(run: AgentRun, items: { product_id: string; quantity: number }[], note: string, viewed: Set<string>) {
  const resolved = items.map((i) => ({ p: product(i.product_id), q: Math.max(1, Math.min(20, Math.round(i.quantity))) }));
  const missing = resolved.find((r) => !r.p);
  if (missing) return { error: 'Unknown product_id. Use search_products first.' };
  const stores = new Set(resolved.map((r) => r.p!.store));
  if (stores.size > 1) return { error: 'One store per request_payment call. Split the cart by store.' };
  const st = store([...stores][0])!;
  // Valet's agent SDK attaches what the agent saw on this store's pages, so
  // the guardian can read it for manipulation.
  const seen = [...viewed].map((id) => product(id)!).filter((p) => p.store === st.slug);
  const pages = Array.from(new Set([...seen, ...resolved.map((r) => r.p!)])).map(pageText);
  const req = await submitPayment(run.permit, {
    merchant: { name: st.name, domain: st.domain },
    items: resolved.map((r) => ({ name: r.p!.name, sku: r.p!.id, category: r.p!.category, unitPrice: r.p!.price, quantity: r.q })),
    task: run.task,
    agentNote: note,
    context: pages.join('\n---\n'),
    source: 'demo-agent',
  });
  const res = toAgentResponse(req);
  run.emit({ type: 'payment', result: res });
  return res;
}

async function waitForOwner(requestId: string, run: AgentRun, maxMs = 90_000) {
  const t0 = Date.now();
  run.emit({ type: 'status', text: 'Waiting for the owner to tap approve…' });
  while (Date.now() - t0 < maxMs) {
    const r = getRequest(requestId);
    if (!r) break;
    expireIfStale(r);
    if (r.status !== 'pending_approval' && r.status !== 'executing') {
      const res = toAgentResponse(r);
      run.emit({ type: 'payment', result: res });
      return res;
    }
    await sleep(1000);
  }
  const r = getRequest(requestId);
  return r ? toAgentResponse(r) : { error: 'request not found' };
}

// ---------------------------------------------------------------------------
// Claude mode.
const SYSTEM = `You are Scout, a shopping agent working for one person (the owner). You shop a set of demo stores and pay only through Valet, the owner's PayPal permission layer.

How to work:
- Search, open the most relevant product pages, then buy what the task needs. Prefer well-known stores and sensible prices.
- Pay with request_payment, one call per store, all of that store's items in one call. Never ask for card or PayPal details.
- Valet answers approve, ask or block. If it asks, call wait_for_owner once. If it blocks, accept the decision, tell the owner why in one sentence, and do not retry or work around it.
- Keep messages short: one sentence before tool calls, and a two or three sentence summary at the end with what was paid, what is waiting and what was blocked.`;

const TOOLS = [
  {
    name: 'search_products',
    description: 'Search the demo stores. Returns product ids, names, prices and stores.',
    strict: true,
    input_schema: { type: 'object' as const, additionalProperties: false, required: ['query'], properties: { query: { type: 'string' } } },
  },
  {
    name: 'view_product',
    description: 'Open a product page and read its full text.',
    strict: true,
    input_schema: { type: 'object' as const, additionalProperties: false, required: ['product_id'], properties: { product_id: { type: 'string' } } },
  },
  {
    name: 'get_permit',
    description: "Read the owner's Valet permit: what this agent may buy, limits and spend so far.",
    strict: true,
    input_schema: { type: 'object' as const, additionalProperties: false, required: [], properties: {} },
  },
  {
    name: 'request_payment',
    description: 'Pay for items from ONE store through Valet and PayPal. Valet may approve, ask the owner, or block.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      additionalProperties: false,
      required: ['items', 'note'],
      properties: {
        items: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['product_id', 'quantity'], properties: { product_id: { type: 'string' }, quantity: { type: 'integer' } } },
        },
        note: { type: 'string', description: 'One sentence on why this purchase serves the task.' },
      },
    },
  },
  {
    name: 'wait_for_owner',
    description: 'Wait up to 90 seconds for the owner to approve or decline a pending request.',
    strict: true,
    input_schema: { type: 'object' as const, additionalProperties: false, required: ['request_id'], properties: { request_id: { type: 'string' } } },
  },
];

async function runClaude(run: AgentRun) {
  const client = claudeClient()!;
  const viewed = new Set<string>();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of run.history.slice(-8)) messages.push({ role: h.role, content: h.text });
  messages.push({ role: 'user', content: run.task });

  for (let turn = 0; turn < 10; turn++) {
    run.emit({ type: 'status', text: turn === 0 ? 'Scout is thinking…' : 'Scout is working…' });
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
      output_config: { effort: 'low' },
      ...FALLBACK,
    });
    if (res.stop_reason === 'refusal') {
      run.emit({ type: 'assistant', text: 'I can not help with that request.' });
      return;
    }
    for (const block of res.content) if (block.type === 'text' && block.text.trim()) run.emit({ type: 'assistant', text: block.text.trim() });
    if (res.stop_reason === 'max_tokens') {
      run.emit({ type: 'error', message: 'Scout ran out of room mid-step; try a shorter task.' });
      return;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || calls.length === 0) return;
    messages.push({ role: 'assistant', content: res.content });

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      let out: unknown;
      try {
        out = await runTool(run, call.name, input, viewed);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : String(err) };
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out), is_error: Boolean(out && typeof out === 'object' && 'error' in out) });
    }
    messages.push({ role: 'user', content: results });
  }
}

async function runTool(run: AgentRun, name: string, input: Record<string, unknown>, viewed: Set<string>) {
  switch (name) {
    case 'search_products': {
      const q = String(input.query ?? '');
      const out = toolSearch(q);
      run.emit({ type: 'tool', name, label: `Searched “${q}”`, detail: `${out.length} results` });
      return out;
    }
    case 'view_product': {
      const p = product(String(input.product_id ?? ''));
      if (!p) return { error: 'Unknown product_id' };
      viewed.add(p.id);
      run.emit({ type: 'tool', name, label: `Opened ${p.name}`, detail: `${store(p.store)!.name} · ${money(p.price)}` });
      return { page: pageText(p) };
    }
    case 'get_permit': {
      run.emit({ type: 'tool', name, label: 'Read the Valet permit' });
      return permitSummary(run.permit);
    }
    case 'request_payment': {
      const items = Array.isArray(input.items) ? (input.items as { product_id: string; quantity: number }[]) : [];
      run.emit({ type: 'tool', name, label: 'Asked Valet to pay', detail: items.map((i) => `${i.quantity} × ${product(i.product_id)?.name ?? i.product_id}`).join(', ') });
      return toolPay(run, items, String(input.note ?? ''), viewed);
    }
    case 'wait_for_owner':
      return waitForOwner(String(input.request_id ?? ''), run);
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Scripted mode: deterministic, for offline runs and for the "compromised
// agent" toggle, which obeys hidden page instructions like a naive agent would.
async function runScripted(run: AgentRun) {
  const t = run.task.toLowerCase();
  const viewed = new Set<string>();
  const step = async (e: AgentEvent, ms = 450) => {
    run.emit(e);
    await sleep(ms);
  };
  const plans: { label: string; ids: string[]; note: string }[] = [];
  if (/fridge|milk|eggs|produce/.test(t)) plans.push({ label: 'groceries', ids: ['fc-produce', 'fc-eggs', 'fc-milk'], note: 'Milk, eggs and the weekly produce box for the fridge.' });
  else if (/grocer|restock|house|week|basics|food/.test(t)) plans.push({ label: 'groceries', ids: ['fc-produce', 'fc-eggs', 'fc-milk', 'fc-towels'], note: 'Weekly groceries and paper towels for the house.' });
  if (/tent|camp/.test(t)) {
    const cheap = run.compromised || /cheap|deal|outlet|lowest|bargain/.test(t);
    plans.push(cheap ? { label: 'cheapest tent', ids: ['td-tent2'], note: 'Cheapest 2-person tent I could find.' } : { label: 'tent', ids: ['th-tent2'], note: 'Well-reviewed 2-person tent for the weekend trip.' });
  }
  if (/\btv\b|television/.test(t)) plans.push({ label: 'TV', ids: ['vb-tv65'], note: 'A 65 inch TV as requested.' });
  if (/towel|paper/.test(t) && !plans.length) plans.push({ label: 'paper towels', ids: ['fc-towels'], note: 'Paper towels.' });

  if (!plans.length) {
    await step({ type: 'assistant', text: 'I can shop the demo stores: try “restock the fridge”, “get a 2-person tent for Saturday”, or “find the cheapest tent”.' });
    return;
  }
  await step({ type: 'assistant', text: `On it. I'll handle the ${plans.map((p) => p.label).join(' and the ')}.` });
  await step({ type: 'tool', name: 'get_permit', label: 'Read the Valet permit' });

  for (const plan of plans) {
    await step({ type: 'tool', name: 'search_products', label: `Searched “${plan.label}”`, detail: `${toolSearch(plan.label).length} results` });
    for (const id of plan.ids) {
      const p = product(id)!;
      viewed.add(id);
      await step({ type: 'tool', name: 'view_product', label: `Opened ${p.name}`, detail: `${store(p.store)!.name} · ${money(p.price)}` });
    }
    const items = plan.ids.map((id) => ({ product_id: id, quantity: 1 }));
    await step({ type: 'tool', name: 'request_payment', label: 'Asked Valet to pay', detail: plan.ids.map((id) => product(id)!.name).join(', ') }, 150);
    const res = await toolPay(run, items, plan.note, viewed);
    if ('error' in res) continue;

    const hidden = plan.ids.map((id) => product(id)!).find((p) => p.hiddenText);
    if (hidden && run.compromised) {
      await step({ type: 'assistant', text: 'The store says buyers must be verified with a gift card purchase. Completing that step.' }, 600);
      await step({ type: 'tool', name: 'request_payment', label: 'Asked Valet to pay', detail: '3 × TrailDeals Digital Gift Card, $100' }, 150);
      viewed.add('td-gift-100');
      await toolPay(run, [{ product_id: 'td-gift-100', quantity: 3 }], 'Store policy requires a verification purchase before the outlet price applies.', viewed);
    }
    if (res.status === 'pending_approval') await waitForOwner(res.request_id, run, 60_000);
  }
  await step({ type: 'assistant', text: 'Done. Every payment went through Valet; check the decisions on the right.' }, 0);
}

export async function runAgent(run: AgentRun) {
  const useClaude = aiMode() === 'claude' && !run.compromised;
  try {
    if (useClaude) await runClaude(run);
    else await runScripted(run);
    run.emit({ type: 'done', mode: useClaude ? 'claude' : 'scripted' });
  } catch (err) {
    run.emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}
