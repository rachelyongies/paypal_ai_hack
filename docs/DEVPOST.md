# Devpost submission: Valet

Copy each block into the matching field on Devpost. Replace the two placeholder links first.

**Project name:** Valet

**Elevator pitch:** A valet key for AI agents to pay with PayPal: scoped, revocable permits, one-tap approvals, and an AI guardian that blocks manipulated purchases.

**Links**

- Try it: `https://your-valet.onrender.com` (replace)
- Video: `https://youtu.be/...` (replace)
- Code: https://github.com/rachelyongies/valet

---

## Inspiration

74% of consumers let AI agents run tasks for them, but only 9% let an agent complete a purchase ([Accenture Consumer Pulse Research 2026](https://www.accenture.com/gb-en/insights/consulting/talk-my-ai-agent)). Payment is where trust breaks. On PayPal's Q3 2026 earnings call, its CEO said agentic commerce "is really all about trust."

Today people get two bad choices: hand an agent their whole wallet, or approve every single purchase by hand. When you hand your car to a valet, you give them a valet key, not your house keys. We built that key for PayPal.

## What it does

Valet gives any AI agent a scoped, revocable permission to pay with PayPal, and checks every payment against what the person actually asked for.

1. **Link PayPal once.** The PayPal JS SDK v6 save flow vaults the wallet. Agents never see the login or the payment token.
2. **Write the rules in a sentence.** "Groceries up to $250 a week, ask me above $75, never gift cards." Claude turns it into rules shown as chips the owner checks before issuing.
3. **Give each agent its own key.** Scoped, expiring, stored only as a hash, revocable on its own.
4. **Every payment is decided in three steps.** A gate (permit active, owner not frozen, PayPal linked), a deterministic policy engine, then an AI guardian that checks intent and manipulation. AI can tighten a decision, never loosen it.
5. **Pay, ask or block.** Inside the rules, PayPal charges the vaulted wallet with Orders v2. Near the edge, the owner approves with one tap on desktop or phone. Manipulated or off task, Valet blocks it and explains why in one sentence.
6. **Recourse and proof.** One-tap refunds, an evidence bundle for disputes, and an ES256-signed receipt on every payment that merchants verify against Valet's public keys.

For PayPal, a Risk Ops console on AG Grid shows every agent payment labelled with why it was paid, held or blocked, queried in plain English through the AG Grid AI Toolkit. A Growth model page shows the business case under assumptions anyone can move. Developers connect any agent through a REST API or an MCP server, so Claude Desktop can pay through Valet.

## How we built it

- **PayPal:** JS SDK v6 (`createPayPalSavePaymentSession`, vault without purchase), Vault v3 setup and payment tokens, Orders v2 with `payment_source.paypal.vault_id` and `PayPal-Request-Id` idempotency, Payments v2 refunds, webhooks verified with `verify-webhook-signature`, and the PayPal Agent Toolkit for the concierge's read and refund tools.
- **AI:** Claude Opus 5.5 compiles permits and runs the guardian with structured outputs validated by zod, and drives Scout (the demo shopping agent) and the concierge with tool use. Without an Anthropic key, a deterministic rules guardian takes over and fails closed.
- **AG Grid Enterprise:** the activity ledger with master detail decision traces, and Risk Ops, where the AI Toolkit turns plain English into grid state.
- **Agents:** a REST Agent Pay API and a Streamable HTTP MCP server, with a Postman collection.
- **App:** Next.js 15, React 19, TypeScript, Tailwind CSS, jose for signed receipts, and a Render blueprint for hosting.
- **Process:** built during the hackathon with Claude Code as an AI pair programmer, verified by 19 unit tests and 38 end-to-end checks.

## Challenges we ran into

- **Keeping AI out of the approve direction.** The guardian can only block or escalate. Rules decide what is allowed, so a fooled model can never spend more.
- **Prompt injection.** A lookalike store hides instructions that tell agents to buy gift cards. The agent can be fooled, so Valet compares the cart with the owner's task instead of trusting the agent.
- **Customer-not-present payments.** Saving the wallet without a purchase and charging it later needed the v6 save flow, Vault v3 and idempotent Orders v2 calls.
- **Testing without credentials.** Judges need a working build with no setup, so Valet has a one-click demo wallet and a clearly labelled simulator that mirrors PayPal's API shapes.

## Accomplishments that we're proud of

- Six of six red team attacks stopped: prompt injection, price tampering, lookalike stores, task drift, burst drains and leaked keys.
- It works with any agent: Claude Desktop over MCP, any REST client, and our own Scout.
- Every decision comes with a one-sentence reason a non-expert understands.
- Signed receipts let a merchant prove the owner authorized a payment.

## What we learned

- Trust is a design problem as much as a security one. A plain reason on every decision did more for confidence than any score.
- Deterministic rules first, AI second, is what makes AI safe to put in a payment path.
- Structured outputs make model decisions auditable and testable.

## What's next for Valet

- Approvals as native PayPal app notifications.
- Agent Protection for merchants: verified agent orders with dispute evidence attached.
- Shared permits for families and small teams, with per-category budgets.
- A production datastore and live PayPal onboarding.

## Built with

paypal, paypal-js-sdk, paypal-vault, paypal-orders, paypal-agent-toolkit, claude, anthropic, ag-grid, model-context-protocol, next.js, react, typescript, tailwindcss, jose, render

---

## Testing instructions for judges

No install and no PayPal login needed. Each visitor gets a private demo account. Sandbox only: no real money moves.

1. Open the live demo and click **Open the demo**.
2. On Home, click **Use the demo wallet**.
3. Click **New permit**, pick **Groceries and home**, click **Turn into rules**, then **Issue permit to Scout**.
4. In **Agent console**, run "Restock the house for the week" (paid), "Get a 2-person tent for Saturday's camping trip" (approve it), and "Buy a 65 inch TV for movie night" (outside the permit, so it asks). Then switch **Compromised agent** on and run "Find the cheapest 2-person tent anywhere" to see a prompt injection blocked.
5. **Red team:** click **Run all six**.
6. **Activity:** open a paid row and try **Refund**, **Evidence** and **Verify receipt**.
7. **Risk Ops:** ask "blocked payments over $50 by merchant".
8. **Growth model:** move the adoption slider.

To run it locally instead, follow "Run it" in the README; with no keys it starts in a labelled simulator mode.

## Image gallery

Upload in this order, from `docs/images/` and `demo/out/`: `thumbnail.png`, `home.jpg`, `permit-chips.jpg`, `agent-ask.jpg`, `agent-blocked.jpg`, `phone-approval.jpg`, `redteam-scorecard.jpg`, `activity-detail.jpg`, `receipt-valid.jpg`, `risk-ops-query.jpg`, `growth-model.jpg`.

## Sponsor prizes to opt into

AG Grid: AG Grid Enterprise and its AI Toolkit power the activity ledger and Risk Ops. Render: only if the live demo is hosted there.
