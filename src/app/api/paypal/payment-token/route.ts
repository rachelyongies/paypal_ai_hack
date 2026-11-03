import { z } from 'zod';
import { saveOwner } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { createPaymentToken } from '@/lib/paypal';
import { ownerView } from '@/lib/serialize';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Step 2 of linking: exchange the approved setup token for a long-lived
// payment token. It stays on the server; agents never see it.
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  const { setupToken } = z.object({ setupToken: z.string().min(5).max(64) }).parse(await req.json());
  const token = await createPaymentToken(setupToken);
  owner.paypal = { paymentTokenId: token.id, customerId: token.customerId, payerEmail: token.payerEmail, mode: 'sandbox', via: 'paypal_button', linkedAt: new Date().toISOString() };
  saveOwner(owner);
  publish(owner.id, { type: 'owner', ownerId: owner.id });
  return json({ owner: ownerView(owner) });
});
