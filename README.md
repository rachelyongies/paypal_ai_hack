# Valet: a valet key for AI agents to pay with PayPal

**Let agents pay. Keep the keys.** Valet gives any AI agent a scoped, revocable permission to pay with PayPal, and checks every payment against what you actually asked for.

Not another shopping agent: Valet is the trust layer every agent needs before it pays with PayPal, whether it shops, pays a contractor when a job is done, or settles with another agent.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/). Sandbox prototype; not affiliated with or endorsed by PayPal.

- **Live demo:** https://valet-sszh.onrender.com (each visitor gets a private demo account; the free server takes about a minute to wake up)

![Valet landing page](docs/images/landing-hero.jpg)

## For judges: try it in 5 minutes

No install and no PayPal login needed. Each visitor gets a private demo account.

1. Open the live demo and click **Open the demo**.
2. On Home, click **Use the demo wallet** (a vaulted PayPal sandbox wallet), or **Link PayPal** with a PayPal sandbox personal account.
3. Click **New permit**, pick the **Groceries and home** template, click **Turn into rules**, check the rules summary, then click **Issue permit to Scout**.
4. Open **Agent console** and run the prompts in order. "Restock the fridge: milk, eggs and a produce box" is paid at once (under $75). "Get a 2-person tent for Saturday's camping trip" is over $75, so it waits for your one-tap approval. "Buy a 65 inch TV for movie night" is outside the permit, so it asks you. Then switch **Compromised agent** on and run "Find the cheapest 2-person tent anywhere" to watch Valet block a prompt injection.
5. Open **Red team** and click **Run all six**: six attacks, six stopped.
6. Open **Activity**, open a paid row, then try **Refund**, **Evidence** and **Verify receipt**.
7. Open **Risk Ops** and ask "blocked payments over $50 by merchant".
8. Open **Growth model** and move the adoption slider.

**What the status line means.** The bottom of the sidebar shows which services are live:

| Label | Meaning |
| --- | --- |
| PayPal sandbox | Real PayPal sandbox calls: Vault v3, Orders v2, Refunds and webhooks |
| PayPal simulator | No PayPal keys are set; a clearly labelled simulator with the same API shapes |
| Claude guardian | Claude Opus 5.5 compiles permits and checks the intent of every payment |
| Rules guardian | No Anthropic key is set; a deterministic fallback that fails closed |

## Why

74% of consumers let AI agents execute tasks, but only 9% let them complete purchases ([Accenture Consumer Pulse Research 2026](https://www.accenture.com/gb-en/insights/consulting/talk-my-ai-agent), 25,590 consumers, 16 countries). Payment is the highest hurdle in the whole journey. Accenture names the four safeguards that unlock it: configurable permissions, instant override, clear recourse and data safeguards. Valet ships all four on PayPal rails.

PayPal's CEO put it plainly on the Q3 2026 earnings call: agentic commerce "is really all about trust." Today a person can either hand an agent full payment credentials or approve every purchase by hand. Valet is the middle ground.

## What it does

1. **Link PayPal once.** The PayPal JS SDK v6 save flow vaults the owner's wallet (Vault v3 setup token, then payment token). Agents never see it.
2. **Write the rules in a sentence.** "Weekly house shopping up to $250 a week, ask me over $75, never gift cards." Claude compiles it into enforceable rules, shown as a summary the owner checks before issuing.
3. **Give each agent its own key.** Scoped, expiring, stored only as a hash. Revoke one without touching the others.
4. **Every payment is decided in three steps.** A gate (permit active, owner not frozen, PayPal linked), a deterministic policy engine, then an AI guardian that checks intent: does the cart serve the owner's task, and is anything manipulating the agent? **AI can tighten, never loosen.**
5. **Approve, ask or block.** Inside the rules, PayPal charges the vaulted wallet (Orders v2 with `vault_id`). Near the edge, the owner approves with one tap, on desktop or phone. Manipulated or off task, Valet blocks it and explains why.
6. **Recourse and proof.** One-tap refunds through the Refunds API, an evidence bundle for disputes, and an ES256-signed receipt on every payment that merchants verify against Valet's JWKS.

| | |
| --- | --- |
| ![Home: agent spend, approvals and controls in one place](docs/images/home.jpg) | ![A permit written in one sentence, compiled into rules](docs/images/permit-chips.jpg) |
| ![An agent payment waiting for one tap](docs/images/agent-ask.jpg) | ![A prompt injection blocked before money moved](docs/images/agent-blocked.jpg) |
| ![Red team: six attacks, six stopped](docs/images/redteam-scorecard.jpg) | ![Risk Ops queried in plain English on AG Grid](docs/images/risk-ops-query.jpg) |

## How it grows PayPal

Open **Growth model** (`/impact`) and move the assumptions live. The base case is illustrative and labelled as such in the app:

| Assumption | Base case |
| --- | --- |
| Active accounts that give an agent a permit | 1% of 440M |
| Agent spend per wallet | $150 a month |
| New PayPal accounts per adopter | 10% |
| Revenue per dollar of TPV | 1.77% (Q3 2026: $8.6B revenue on $487.1B TPV) |

That yields **4.84M agent wallets, +440K new PayPal accounts, $8.7B agent TPV and about $154M revenue a year.** At 3% adoption it is about $461M.

![Growth model](docs/images/growth-model.jpg)

Where it comes from: every agent needs a wallet (new accounts), approvals and receipts live on a PayPal surface (weekly engagement), clear rules move the 32% who let agents pick but not pay into checkout (agent TPV, [Accenture](https://www.accenture.com/gb-en/insights/consulting/talk-my-ai-agent)), payments run on the vaulted PayPal wallet (margin), signed intent records settle claims on evidence (lower losses), and verified agent orders open a merchant protection add-on (new revenue line).

## Design

A calm, card-based money app. Each screen has one primary action, amounts come first, and every decision is explained in a plain sentence. Owners see "Paid", "Needs you" and "Blocked"; risk scores, signals and order IDs stay in Risk Ops where PayPal's analysts need them. PayPal blues mark trust and brand moments, black buttons mark decisions, and the freeze switch is always one tap away in the sidebar.

## Features

| Feature | Where |
| --- | --- |
| Link PayPal with the JS SDK v6 vault flow, or a one-click sandbox demo wallet | `/app` |
| Plain-English permits compiled by Claude, editable before issuing | `/app/permits/new` |
| Policy engine: amount integrity, never-lists, caps, burst limit, scope, lookalike merchants, budget, duplicates, approval threshold | `src/lib/policy.ts` |
| AI guardian (Claude Opus 5.5, structured output) with a deterministic fallback that fails closed | `src/lib/guardian.ts` |
| One-tap approvals with a QR code for the phone | `/app`, `/approve/[id]` |
| Instant override: pause, revoke, freeze all agent payments, unlink PayPal | sidebar switch, Home, permit cards |
| Activity ledger on AG Grid with master detail decision traces, refunds and evidence | `/app/activity` |
| Scout, a demo shopping agent (Claude tool use) that can only pay through Valet | `/agent` |
| Red team lab: six attacks against a live permit | `/redteam` |
| Risk Ops console for PayPal's risk team, queried in plain English with AG Grid's AI Toolkit | `/ops` |
| Growth model: PayPal accounts, agent TPV and revenue from live assumptions | `/impact` |
| Signed receipts and a merchant verifier | `/verify`, `/.well-known/jwks.json` |
| Concierge: Claude with the PayPal Agent Toolkit, limited to read and refund | `/app` |
| REST Agent Pay API and an MCP server for any agent | `/developers` |
| Verified PayPal webhooks for captures, refunds, reversals, disputes and vault deletions | `/api/webhooks/paypal` |

## How a payment flows

```mermaid
flowchart TD
  A[AI agent: Scout, Claude Desktop via MCP, or any REST client] -->|merchant, items, task + permit key| G[Gate: permit, freeze, PayPal linked]
  G --> P[Policy engine, deterministic]
  P --> AI[AI guardian: Claude checks intent]
  AI -->|inside the rules| PAY[PayPal Orders v2 with vault_id]
  AI -->|near the edge| ASK[Owner approves with one tap]
  ASK --> PAY
  AI -->|manipulated or off task| BLOCK[Blocked with a plain-English reason]
  PAY --> R[Signed receipt + live ledger + Risk Ops]
```

## PayPal integration

| API | Use in Valet | Code |
| --- | --- | --- |
| OAuth 2.0 (`response_type=client_token`) | Browser-safe client token for the JS SDK v6 | `src/lib/paypal.ts` |
| JS SDK v6 `createPayPalSavePaymentSession` | Owner links PayPal without a purchase | `src/components/PayPalLink.tsx` |
| Vault v3 setup and payment tokens | Long-lived wallet token, kept server side | `src/lib/paypal.ts` |
| Orders v2 with `payment_source.paypal.vault_id` | Customer-not-present agent payments, idempotent via `PayPal-Request-Id` | `chargeVault` |
| Payments v2 refunds | One-tap refunds | `refundCapture` |
| Webhooks + `verify-webhook-signature` | Captures, refunds, reversals, disputes, vault deletions | `src/app/api/webhooks/paypal/route.ts` |
| PayPal Agent Toolkit | The concierge's read and refund tools | `src/lib/concierge.ts` |

## AI

- **Claude Opus 5.5** compiles permits, runs the guardian, drives Scout and the concierge, and answers grid queries. Structured outputs (`output_config.format`) plus zod validation; server-side refusal fallback enabled.
- **AG Grid AI Toolkit:** the grid describes its own state as a JSON schema (`getStructuredSchema`), Claude fills it from plain English, the grid applies it (`setState`).
- **Fallbacks:** without an Anthropic key, a deterministic rules guardian and compiler take over, so judges always get a working product.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With no keys, Valet runs a labelled PayPal simulator and the rules guardian.

**PayPal sandbox:** create a REST app at developer.paypal.com, enable **Save payment methods** in the app's features, then set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. For the one-click demo wallet, link once with the PayPal button and copy the payment token into `DEMO_VAULT_ID`. Register `https://<host>/api/webhooks/paypal` and set `PAYPAL_WEBHOOK_ID`.

**Claude:** set `ANTHROPIC_API_KEY`. The model defaults to `claude-opus-5-5`.

**AG Grid:** Enterprise features run in trial mode with a watermark; set `NEXT_PUBLIC_AG_GRID_LICENSE_KEY` to remove it.

## Connect an agent

```bash
curl -X POST "$VALET_URL/api/agent/pay" \
  -H "Authorization: Bearer $VALET_PERMIT" \
  -H "Content-Type: application/json" \
  -d '{"merchant":{"name":"FreshCart","domain":"freshcart.example"},"items":[{"name":"Paper towels, 6 rolls","sku":"fc-towels","category":"household","unit_price":13.5,"quantity":1}],"task":"Restock paper towels"}'
```

Claude Desktop (MCP), in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "valet": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<host>/api/mcp", "--header", "Authorization:${VALET_AUTH}"],
      "env": { "VALET_AUTH": "Bearer vlt_sb_..." }
    }
  }
}
```

A Postman collection is in `postman/`.

## Test

```bash
npm test
```

```bash
npm run smoke
```

`npm test` runs 23 unit tests on the policy engine, compiler, guardian and Risk Ops query handling. `npm run smoke` runs 38 end-to-end checks over HTTP against a running server (`BASE_URL`), including all six red team attacks. Run it in simulator mode, or in sandbox mode with `DEMO_VAULT_ID` set so the demo wallet can link.

## Deploy

Render: **New > Blueprint**, point it at this repo, and fill in the secrets from `render.yaml`: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `DEMO_VAULT_ID`, `ANTHROPIC_API_KEY`, and optionally `NEXT_PUBLIC_AG_GRID_LICENSE_KEY`. The public URL comes from Render automatically. After the first deploy, register `https://<host>/api/webhooks/paypal` in your PayPal app for `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `VAULT.PAYMENT-TOKEN.DELETED`, then set `PAYPAL_WEBHOOK_ID`; until then Valet refuses webhook events. The blueprint uses Render's free plan: the service sleeps after about 15 idle minutes, takes up to a minute to wake, and starts with fresh demo data after each restart. For an always-on service that keeps data, switch to `plan: starter` and enable the disk noted in `render.yaml`. Any Node 20+ host works with `npm run build` and `npm start`.

## Limitations

- Sandbox only. No live PayPal money moves, and the app never asks for real PayPal credentials.
- Data lives in a JSON file (`DATA_DIR`), which suits a demo; production would use a database.
- Demo accounts are anonymous browser sessions, with no sign-up.
- The stores, products and the persona "Maya" are fictional. Demo stores use reserved `.example` domains, so no real business is depicted.
- The growth model is illustrative. Only PayPal's 440M accounts and 1.77% revenue per dollar of TPV come from reported Q3 2026 results.
- AG Grid Enterprise shows a trial watermark until `NEXT_PUBLIC_AG_GRID_LICENSE_KEY` is set.

## Security notes

- Agents hold scoped Valet keys only; the PayPal payment token never leaves the server.
- Keys are stored as SHA-256 hashes and shown once.
- The model can block or escalate, never approve beyond the written rules.
- If Claude is unavailable, the rules guardian decides (fail closed, never fail open).
- Webhooks are signature-verified with PayPal before they change state. Against real PayPal, events are refused until `PAYPAL_WEBHOOK_ID` is set; only the labelled simulator accepts unsigned test events.
- Receipts are ES256 JWS with a published JWKS.

## Project layout

```
src/app           Next.js pages and API routes
src/lib           decision engine, PayPal client, Claude helpers, MCP, red team
src/components    UI kit, AG Grid ledgers, approval cards
tests             unit tests
scripts           end-to-end smoke test
```

## Built with

PayPal (Vault v3, Orders v2, Payments, Webhooks, JS SDK v6, Agent Toolkit), Claude Opus 5.5 (Anthropic API), AG Grid Enterprise with the AI Toolkit, Model Context Protocol, Next.js, React, Tailwind CSS, jose, Render. Developed with Claude Code as an AI pair programmer.

## License

Valet's code is MIT. See [LICENSE](LICENSE).

Dependencies keep their own licenses: MIT, ISC, Apache-2.0 and OFL-1.1 (the Inter font), except AG Grid Enterprise, which is commercial. It runs in trial mode without a key; set `NEXT_PUBLIC_AG_GRID_LICENSE_KEY` with a key from AG Grid, a hackathon sponsor. Every screenshot is of Valet itself.
