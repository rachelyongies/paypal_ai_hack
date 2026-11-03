import { requestsFor } from '@/lib/db';
import { expireIfStale } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const owner = await requireOwner();
  return json({ requests: requestsFor(owner.id).slice(0, 500).map(expireIfStale) });
});
