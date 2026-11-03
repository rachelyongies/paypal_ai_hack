import { getRequest } from '@/lib/db';
import { expireIfStale } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { currentOwner, HttpError } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Request detail for the owner, or for a phone holding the approval link key.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const key = new URL(req.url).searchParams.get('k');
  const r = getRequest(id);
  if (!r) throw new HttpError(404, 'Request not found');
  const owner = await currentOwner();
  const allowed = owner?.id === r.ownerId || (key && r.approval?.key === key);
  if (!allowed) throw new HttpError(403, 'This approval link is not valid.');
  return json({ request: expireIfStale(r) });
});
