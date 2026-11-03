import { z } from 'zod';
import { decide } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { currentOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// One tap: approve (PayPal charges immediately) or decline.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = z.object({ decision: z.enum(['approve', 'decline']), via: z.enum(['web', 'phone']).default('web'), k: z.string().optional() }).parse(await req.json());
  const owner = await currentOwner();
  const r = await decide(owner, id, body.decision, body.via, body.k);
  return json({ request: r });
});
