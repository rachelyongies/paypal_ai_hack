import { config, paypalMode } from '@/lib/config';
import { saveOwner } from '@/lib/db';
import { publish } from '@/lib/events';
import { handle, json } from '@/lib/http';
import { ownerView } from '@/lib/serialize';
import { HttpError, requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// One-click wallet for judges: a sandbox payment token created ahead of time
// with the real PayPal flow (DEMO_VAULT_ID), or the simulator without keys.
export const POST = handle(async () => {
  const owner = await requireOwner();
  const sandbox = paypalMode() === 'sandbox';
  if (sandbox && !config.paypal.demoVaultId) throw new HttpError(400, 'No DEMO_VAULT_ID configured. Link with the PayPal button instead.');
  owner.paypal = {
    paymentTokenId: sandbox ? config.paypal.demoVaultId : `SIM-VAULT-${owner.id.slice(-8)}`,
    payerEmail: sandbox ? 'sandbox demo buyer' : 'demo.buyer@example.com',
    mode: sandbox ? 'sandbox' : 'simulated',
    via: 'demo_wallet',
    linkedAt: new Date().toISOString(),
  };
  saveOwner(owner);
  publish(owner.id, { type: 'owner', ownerId: owner.id });
  return json({ owner: ownerView(owner) });
});
