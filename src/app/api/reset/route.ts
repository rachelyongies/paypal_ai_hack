import { resetOwnerData, saveOwner } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Clears this visitor's demo data so a rehearsal can start fresh.
export const POST = handle(async () => {
  const owner = await requireOwner();
  resetOwnerData(owner.id);
  owner.frozen = false;
  saveOwner(owner);
  publish(owner.id, { type: 'owner', ownerId: owner.id });
  return json({ ok: true });
});
