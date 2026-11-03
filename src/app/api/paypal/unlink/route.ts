import { saveOwner } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { deletePaymentToken } from '@/lib/paypal';
import { ownerView } from '@/lib/serialize';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// The nuclear option: delete the vaulted payment token at PayPal.
export const POST = handle(async () => {
  const owner = await requireOwner();
  if (owner.paypal && owner.paypal.via === 'paypal_button') {
    await deletePaymentToken(owner.paypal.paymentTokenId, owner.paypal.mode).catch((e) => console.warn('[valet] unlink', e?.message));
  }
  owner.paypal = null;
  saveOwner(owner);
  publish(owner.id, { type: 'owner', ownerId: owner.id });
  return json({ owner: ownerView(owner) });
});
