import { handle, json } from '@/lib/http';
import { createClientToken } from '@/lib/paypal';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Browser-safe client token for the PayPal JS SDK v6.
export const POST = handle(async () => {
  await requireOwner();
  return json({ clientToken: await createClientToken() });
});
