import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Valet developers: let your agent pay with PayPal' };

const PAY = `curl -X POST $VALET_URL/api/agent/pay \\
  -H "Authorization: Bearer $VALET_PERMIT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant": { "name": "FreshCart", "domain": "freshcart.com" },
    "items": [
      { "name": "Weekly produce box", "sku": "fc-produce",
        "category": "groceries", "unit_price": 32, "quantity": 1 }
    ],
    "task": "Restock the house for the week",
    "note": "Fresh produce for four",
    "page_excerpt": "optional: text from the merchant page you relied on"
  }'`;

const RESPONSE = `HTTP/1.1 200 OK            # 202 = waiting for the owner, 403 = blocked
{
  "request_id": "req_3kQ9…",
  "verdict": "approve",        // approve | ask | block
  "status": "paid",            // paid | pending_approval | blocked | declined | expired | failed
  "message": "Paid $32.00 to FreshCart with PayPal.",
  "paypal": { "order_id": "5O190127TN364715T", "capture_id": "3C679366HH908993F", "env": "sandbox" },
  "receipt": "eyJhbGciOiJFUzI1NiIsImtpZCI6InZhbGV0LWVzMjU2LTEiLCJ0eXAiOiJ2YWxldC1yZWNlaXB0K2p3dCJ9…"
}`;

const MCP = `{
  "mcpServers": {
    "valet": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-valet-host>/api/mcp",
               "--header", "Authorization:\${VALET_AUTH}"],
      "env": { "VALET_AUTH": "Bearer vlt_sb_…" }
    }
  }
}`;

const ENDPOINTS = [
  ['POST', '/api/agent/pay', 'Ask to pay. Valet checks policy and intent, then pays with PayPal, asks the owner, or blocks.'],
  ['GET', '/api/agent/requests/{id}', 'Poll a request while the owner decides (approvals expire after 10 minutes).'],
  ['GET', '/api/agent/permit', 'Read the permit: the owner’s words, enforced rules, and spend so far.'],
  ['POST', '/api/mcp', 'MCP server (Streamable HTTP, JSON responses) with the same powers as the REST API.'],
  ['GET', '/.well-known/jwks.json', 'Public key for verifying ES256 agent receipts.'],
  ['POST', '/api/webhooks/paypal', 'PayPal webhook listener (signature-verified) for captures, refunds, disputes, vault.'],
];

const TOOLS = [
  ['valet_get_permit', 'What this agent may buy, limits and spend so far.'],
  ['valet_search_products', 'Search the demo stores for product ids.'],
  ['valet_request_payment', 'Pay one merchant through Valet and PayPal.'],
  ['valet_payment_status', 'Check a pending request.'],
];

export default function Developers() {
  return (
    <Shell>
      <div className="space-y-10">
        <div>
          <Pill tone="blue">Developers</Pill>
          <h1 className="mt-3 text-[36px] font-bold tracking-[-0.03em]">Let your agent pay with PayPal, safely</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            One bearer key per agent. No card data, no PayPal credentials, no trust UX to build: Valet handles consent, policy, intent checks, approvals and PayPal. Get a key by issuing a permit on the{' '}
            <Link className="link" href="/app/permits/new">new permit</Link> page.
          </p>
        </div>

        <section>
          <h2 className="text-xl font-semibold">REST in one call</h2>
          <pre className="code mt-3">{PAY}</pre>
          <pre className="code mt-3">{RESPONSE}</pre>
          <p className="mt-3 text-sm text-ink-muted">
            Categories: groceries, household, outdoor, apparel, electronics, pharmacy, restaurants, travel, subscriptions, digital_goods, gift_cards, crypto, cash_equivalents, alcohol, gambling, other. A Postman collection lives in the repo under <code className="kbd">postman/</code>.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">MCP for Claude Desktop and any MCP client</h2>
            <p className="mt-1 text-sm text-ink-muted">Add to claude_desktop_config.json, restart, and ask Claude to buy something.</p>
            <pre className="code mt-3">{MCP}</pre>
          </div>
          <div>
            <h2 className="text-xl font-semibold">MCP tools</h2>
            <div className="card mt-3 divide-y divide-pp-line">
              {TOOLS.map(([n, d]) => (
                <div key={n} className="p-4">
                  <p className="font-mono text-sm font-semibold">{n}</p>
                  <p className="text-sm text-ink-muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Endpoints</h2>
          <div className="card mt-3 overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-pp-line">
                {ENDPOINTS.map(([m, p, d]) => (
                  <tr key={p}>
                    <td className="w-20 px-4 py-3">
                      <Pill tone={m === 'GET' ? 'blue' : 'ok'}>{m}</Pill>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{p}</td>
                    <td className="px-4 py-3 text-ink-muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface p-6">
          <h2 className="text-xl font-semibold">How a decision is made</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Gate: the permit must be active and unexpired, the owner not frozen, PayPal linked.</li>
            <li>Policy engine (deterministic, under a millisecond): amount integrity, never-lists, caps, burst limit, scope, lookalike merchants, budget, duplicates, approval threshold.</li>
            <li>AI guardian (Claude Opus 5.5, structured output): does the cart serve the owner&apos;s task, and is anything manipulating the agent? It can only tighten a decision.</li>
            <li>Approve: Orders v2 with the vaulted wallet (vault_id), idempotent, then an ES256 receipt. Ask: one-tap approval on the owner&apos;s phone. Block: a plain-English reason.</li>
          </ol>
        </section>
      </div>
    </Shell>
  );
}
