import { getPermit, getRequest } from '@/lib/db';
import { evidence } from '@/lib/decide';
import { handle } from '@/lib/http';
import { HttpError, requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Evidence bundle for disputes: intent, permit, checks, approvals, PayPal ids.
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const owner = await requireOwner();
  const { id } = await ctx.params;
  const r = getRequest(id);
  if (!r || r.ownerId !== owner.id) throw new HttpError(404, 'Request not found');
  return new Response(JSON.stringify(evidence(r, getPermit(r.permitId)), null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="valet-evidence-${r.id}.json"` },
  });
});
