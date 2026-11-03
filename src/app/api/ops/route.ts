import { allRequests, db } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { opsView } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

// Everything PayPal's risk team would see: agent payments, verdicts, webhooks.
export const GET = handle(async () => {
  const requests = allRequests().slice(0, 1000);
  const paid = requests.filter((r) => ['paid', 'partially_refunded', 'refunded'].includes(r.status));
  const blocked = requests.filter((r) => r.verdict === 'block');
  const decided = requests.filter((r) => r.decisionMs > 0).map((r) => r.decisionMs).sort((a, b) => a - b);
  const median = decided.length ? decided[Math.floor(decided.length / 2)] : 0;
  const auto = requests.filter((r) => r.status === 'paid' && !r.approval).length;
  return json({
    requests: requests.map(opsView),
    kpis: {
      agentTpv: Math.round(paid.reduce((s, r) => s + r.amount - (r.paypal?.refundedAmount ?? 0), 0) * 100) / 100,
      requests: requests.length,
      autoApprovedShare: paid.length ? Math.round((auto / paid.length) * 100) : 0,
      blockedValue: Math.round(blocked.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      blockedCount: blocked.length,
      medianDecisionMs: median,
      owners: new Set(requests.map((r) => r.ownerId)).size,
    },
    webhooks: db().webhooks.slice(0, 25),
  });
});
