import { z } from 'zod';
import { handle, json } from '@/lib/http';
import { verifyReceipt } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

// Merchants (or PayPal) verify an agent receipt against Valet's public key.
export const POST = handle(async (req: Request) => {
  const { token } = z.object({ token: z.string().min(20).max(8000) }).parse(await req.json());
  return json(await verifyReceipt(token));
});
