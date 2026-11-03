import { z } from 'zod';
import { handle, json } from '@/lib/http';
import { runScenario, SCENARIOS } from '@/lib/redteam';
import { HttpError, requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = handle(async () => json({ scenarios: SCENARIOS }));

// Fire one attack at the owner's live red team permit.
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  if (!owner.paypal) throw new HttpError(400, 'Link PayPal (or the demo wallet) first, so allowed purchases can really be paid.');
  if (owner.frozen) throw new HttpError(400, 'Unfreeze your agents first; frozen accounts stop everything at the gate.');
  const { scenario } = z.object({ scenario: z.string() }).parse(await req.json());
  const t0 = Date.now();
  const result = await runScenario(owner, scenario);
  return json({ ...result, ms: Date.now() - t0 });
});
