import { z } from 'zod';
import { runAgent, type AgentEvent } from '@/lib/agent';
import { getPermit } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { requireOwner } from '@/lib/session';
import { ndjsonResponse } from '@/lib/stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// Runs Scout, the demo shopping agent, and streams its steps as NDJSON.
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  const body = z
    .object({
      permitId: z.string(),
      task: z.string().min(2).max(600),
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(20).default([]),
      compromised: z.boolean().default(false),
    })
    .parse(await req.json());
  const permit = getPermit(body.permitId);
  if (!permit || permit.ownerId !== owner.id) return json({ error: 'Pick one of your permits first.' }, 404);
  return ndjsonResponse<AgentEvent>((emit) => runAgent({ permit, task: body.task, history: body.history, compromised: body.compromised, emit }));
});
