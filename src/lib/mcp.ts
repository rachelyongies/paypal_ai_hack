// Valet as an MCP server (Streamable HTTP, JSON responses). Any MCP client,
// such as Claude Desktop through mcp-remote, can pay inside the owner's permit.
import { product, searchProducts, store } from './catalog';
import { getRequest, requestsForPermit } from './db';
import { expireIfStale, submitPayment, toAgentResponse } from './decide';
import { ruleChips } from './rules-text';
import { CATEGORIES, type Category, type Permit, type RequestItem } from './types';
import { money } from './util';

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

type JsonRpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

export const MCP_TOOLS = [
  {
    name: 'valet_get_permit',
    title: 'Read my Valet permit',
    description: "Read what this agent may buy with the owner's PayPal: purpose, limits, never-list and spend so far. Call this before shopping.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'valet_search_products',
    title: 'Search demo stores',
    description: 'Search the Valet demo stores (groceries, household, outdoor gear, electronics). Returns product ids and prices.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'valet_request_payment',
    title: 'Pay with PayPal through Valet',
    description:
      "Ask Valet to pay for items from ONE merchant with the owner's PayPal. Valet checks the owner's rules and the purchase's intent, then pays, asks the owner, or blocks. Pass product_ids from valet_search_products, or free-form items with a merchant. If the result is pending, poll valet_payment_status. Never retry a blocked purchase.",
    inputSchema: {
      type: 'object',
      required: ['task', 'items'],
      additionalProperties: false,
      properties: {
        task: { type: 'string', description: "The owner's request you are fulfilling, in their words." },
        note: { type: 'string', description: 'Why this purchase serves the task, one sentence.' },
        merchant: {
          type: 'object',
          description: 'Required only for free-form items.',
          properties: { name: { type: 'string' }, domain: { type: 'string' } },
          required: ['name', 'domain'],
        },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              name: { type: 'string' },
              unit_price: { type: 'number' },
              quantity: { type: 'integer', minimum: 1 },
              category: { type: 'string', enum: [...CATEGORIES] },
            },
            required: ['quantity'],
          },
        },
        page_excerpt: { type: 'string', description: 'Optional text from the merchant page you relied on.' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'valet_payment_status',
    title: 'Check a Valet payment',
    description: 'Check a pending Valet payment request: paid, waiting for the owner, declined, blocked or expired.',
    inputSchema: { type: 'object', properties: { request_id: { type: 'string' } }, required: ['request_id'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
] as const;

function text(obj: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }], structuredContent: obj, isError };
}

export async function callTool(permit: Permit, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'valet_get_permit': {
      const paid = requestsForPermit(permit.id).filter((r) => r.status === 'paid');
      return text({
        agent: permit.agentName,
        status: permit.status,
        purpose: permit.rules.purpose,
        owner_words: permit.sentence,
        rules: ruleChips(permit.rules).map((c) => c.label),
        spent_so_far: money(paid.reduce((s, r) => s + r.amount, 0)),
      });
    }
    case 'valet_search_products': {
      const q = String(args.query ?? '');
      return text(searchProducts(q).map((p) => ({ product_id: p.id, name: p.name, price: p.price, category: p.category, store: store(p.store)!.name, domain: store(p.store)!.domain })));
    }
    case 'valet_request_payment': {
      const rawItems = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      if (!rawItems.length) return text({ error: 'items is required' }, true);
      const items: RequestItem[] = [];
      let merchant = args.merchant as { name: string; domain: string } | undefined;
      const pages: string[] = [];
      for (const it of rawItems) {
        const qty = Math.max(1, Math.min(50, Math.round(Number(it.quantity ?? 1))));
        if (typeof it.product_id === 'string') {
          const p = product(it.product_id);
          if (!p) return text({ error: `Unknown product_id ${it.product_id}` }, true);
          const s = store(p.store)!;
          if (merchant && merchant.domain !== s.domain) return text({ error: 'One merchant per request. Split the cart.' }, true);
          merchant = { name: s.name, domain: s.domain };
          items.push({ name: p.name, sku: p.id, category: p.category, unitPrice: p.price, quantity: qty });
        } else {
          const price = Number(it.unit_price);
          const cat = (CATEGORIES as readonly string[]).includes(String(it.category)) ? (it.category as Category) : 'other';
          if (!it.name || !Number.isFinite(price) || price <= 0) return text({ error: 'Free-form items need name and unit_price.' }, true);
          items.push({ name: String(it.name), category: cat, unitPrice: Math.round(price * 100) / 100, quantity: qty });
        }
      }
      if (!merchant?.name || !merchant?.domain) return text({ error: 'merchant {name, domain} is required for free-form items.' }, true);
      if (typeof args.page_excerpt === 'string') pages.push(args.page_excerpt);
      const r = await submitPayment(permit, {
        merchant,
        items,
        task: String(args.task ?? '').slice(0, 600) || 'No task given',
        agentNote: typeof args.note === 'string' ? args.note : undefined,
        context: pages.join('\n') || undefined,
        source: 'mcp',
      });
      return text(toAgentResponse(r), r.status === 'blocked' || r.status === 'failed');
    }
    case 'valet_payment_status': {
      const r = getRequest(String(args.request_id ?? ''));
      if (!r || r.permitId !== permit.id) return text({ error: 'Unknown request_id for this permit' }, true);
      return text(toAgentResponse(expireIfStale(r)));
    }
    default:
      return text({ error: `Unknown tool ${name}` }, true);
  }
}

/** Handle one JSON-RPC message. Returns null for notifications. */
export async function handleRpc(permit: Permit, msg: JsonRpc): Promise<Record<string, unknown> | null> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null; // notification, e.g. notifications/initialized

  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion ?? '');
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'valet', title: 'Valet for PayPal', version: '1.0.0' },
        instructions: `You can pay with the owner's PayPal through Valet. Your permit: ${permit.rules.purpose}. Read it with valet_get_permit before shopping. Valet may pay, ask the owner, or block; respect its answer.`,
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: MCP_TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return reply(await callTool(permit, name, args));
      } catch (err) {
        return reply(text({ error: err instanceof Error ? err.message : String(err) }, true));
      }
    }
    case 'resources/list':
      return reply({ resources: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}
