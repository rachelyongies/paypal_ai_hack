import { publicStatus } from '@/lib/config';
import { permitsFor, requestsFor, requestsForPermit } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { ownerView, permitView } from '@/lib/serialize';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const owner = await requireOwner();
  const permits = permitsFor(owner.id).map((p) => {
    const spent = requestsForPermit(p.id)
      .filter((r) => ['paid', 'partially_refunded'].includes(r.status))
      .reduce((s, r) => s + r.amount - (r.paypal?.refundedAmount ?? 0), 0);
    return permitView(p, Math.round(spent * 100) / 100);
  });
  const requests = requestsFor(owner.id);
  return json({
    owner: ownerView(owner),
    permits,
    pending: requests.filter((r) => r.status === 'pending_approval').length,
    status: publicStatus(),
  });
});
