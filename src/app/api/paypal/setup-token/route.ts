import { config } from '@/lib/config';
import { handle, json } from '@/lib/http';
import { createSetupToken } from '@/lib/paypal';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Step 1 of linking: a vault setup token that represents the owner's consent.
export const POST = handle(async () => {
  await requireOwner();
  const token = await createSetupToken(`${config.appUrl}/app?linked=1`, `${config.appUrl}/app?linked=0`);
  return json({ id: token.id, status: token.status });
});
