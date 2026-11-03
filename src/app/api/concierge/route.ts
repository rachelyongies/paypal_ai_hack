import { z } from 'zod';
import { runConcierge, type ConciergeEvent } from '@/lib/concierge';
import { handle } from '@/lib/http';
import { requireOwner } from '@/lib/session';
import { ndjsonResponse } from '@/lib/stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

// The owner's concierge, powered by PayPal's Agent Toolkit (read and refund only).
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  const { history } = z
    .object({ history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(4000) })).min(1).max(24) })
    .parse(await req.json());
  return ndjsonResponse<ConciergeEvent>((emit) => runConcierge(owner, history, emit));
});
