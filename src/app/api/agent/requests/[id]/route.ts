import { getRequest } from '@/lib/db';
import { expireIfStale, toAgentResponse } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { bearer, permitFromToken } from '@/lib/permits';

export const dynamic = 'force-dynamic';

// Agents poll here while the owner decides.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const permit = permitFromToken(bearer(req));
  if (!permit) return json({ error: 'invalid_permit' }, 401);
  const { id } = await ctx.params;
  const r = getRequest(id);
  if (!r || r.permitId !== permit.id) return json({ error: 'not_found' }, 404);
  return json(toAgentResponse(expireIfStale(r)));
});
