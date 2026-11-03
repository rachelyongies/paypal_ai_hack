import { z } from 'zod';
import { refund } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Clear recourse: one-tap refund through PayPal's Refunds API.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const owner = await requireOwner();
  const { id } = await ctx.params;
  const { amount } = z.object({ amount: z.number().positive().optional() }).parse(await req.json().catch(() => ({})));
  return json({ request: await refund(owner, id, amount) });
});
