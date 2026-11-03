import { z } from 'zod';
import { getPermit, savePermit } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { permitView } from '@/lib/serialize';
import { HttpError, requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Instant override: pause, resume or revoke one agent's permit.
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const owner = await requireOwner();
  const { id } = await ctx.params;
  const permit = getPermit(id);
  if (!permit || permit.ownerId !== owner.id) throw new HttpError(404, 'Permit not found');
  const { action } = z.object({ action: z.enum(['pause', 'resume', 'revoke']) }).parse(await req.json());
  if (permit.status === 'revoked') throw new HttpError(409, 'Revoked permits cannot change.');
  permit.status = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'revoked';
  savePermit(permit);
  publish(owner.id, { type: 'permit', permit });
  return json({ permit: permitView(permit) });
});
