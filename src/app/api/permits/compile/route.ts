import { z } from 'zod';
import { handle, json } from '@/lib/http';
import { compileRules } from '@/lib/permits';
import { ruleChips } from '@/lib/rules-text';
import { requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Plain English in, enforceable rules out (shown back as chips to confirm).
export const POST = handle(async (req: Request) => {
  await requireOwner();
  const { sentence } = z.object({ sentence: z.string().min(5).max(1200) }).parse(await req.json());
  const t0 = Date.now();
  const out = await compileRules(sentence);
  return json({ ...out, chips: ruleChips(out.rules), ms: Date.now() - t0 });
});
