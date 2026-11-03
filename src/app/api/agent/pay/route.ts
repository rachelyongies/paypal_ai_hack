import { PayBody } from '@/lib/agentApi';
import { submitPayment, toAgentResponse } from '@/lib/decide';
import { handle, json } from '@/lib/http';
import { bearer, permitFromToken } from '@/lib/permits';

export const dynamic = 'force-dynamic';

/**
 * The Agent Pay API. Any agent with a permit token can ask to pay.
 * 200 paid, 202 waiting for the owner, 403 blocked or declined, 401 bad token.
 */
export const POST = handle(async (req: Request) => {
  const permit = permitFromToken(bearer(req));
  if (!permit) return json({ error: 'invalid_permit', message: 'Unknown or malformed permit token.' }, 401);
  const body = PayBody.parse(await req.json());
  const r = await submitPayment(permit, {
    merchant: body.merchant,
    items: body.items.map((i) => ({ name: i.name, sku: i.sku, category: i.category, unitPrice: i.unit_price, quantity: i.quantity })),
    amount: body.amount,
    task: body.task,
    agentNote: body.note,
    context: body.page_excerpt,
    source: 'rest',
  });
  const status = r.status === 'paid' ? 200 : r.status === 'pending_approval' || r.status === 'executing' ? 202 : r.status === 'failed' ? 502 : 403;
  return json(toAgentResponse(r), status);
});
