import { publicStatus } from '@/lib/config';
import { permitsFor, requestsFor, requestsForPermit } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { spentOn } from '@/lib/policy';
import { ownerView, permitView } from '@/lib/serialize';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const owner = await requireOwner();
  const permits = permitsFor(owner.id).map((p) => permitView(p, spentOn(requestsForPermit(p.id), p.rules.budget)));
  const requests = requestsFor(owner.id);
  return json({
    owner: ownerView(owner),
    permits,
    pending: requests.filter((r) => r.status === 'pending_approval').length,
    status: publicStatus(),
  });
});
