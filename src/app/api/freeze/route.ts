import { z } from 'zod';
import { saveOwner } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { ownerView } from '@/lib/serialize';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// The kill switch: every agent stops at the gate until the owner unfreezes.
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  const { frozen } = z.object({ frozen: z.boolean() }).parse(await req.json());
  owner.frozen = frozen;
  saveOwner(owner);
  publish(owner.id, { type: 'owner', ownerId: owner.id });
  return json({ owner: ownerView(owner) });
});
