import { z } from 'zod';
import { gridQuery } from '@/lib/gridquery';
import { handle, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Plain English to AG Grid state, through AG Grid's AI Toolkit schema.
export const POST = handle(async (req: Request) => {
  const body = z.object({ query: z.string().min(2).max(400), schema: z.record(z.string(), z.unknown()), state: z.record(z.string(), z.unknown()) }).parse(await req.json());
  const t0 = Date.now();
  const out = await gridQuery(body);
  return json({ ...out, ms: Date.now() - t0 });
});
