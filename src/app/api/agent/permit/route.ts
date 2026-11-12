import { requestsForPermit } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { bearer, permitFromToken } from '@/lib/permits';
import { spentOn } from '@/lib/policy';
import { ruleChips } from '@/lib/rules-text';

export const dynamic = 'force-dynamic';

// What an agent may do, in the owner's words and as enforced rules.
export const GET = handle(async (req: Request) => {
  const permit = permitFromToken(bearer(req));
  if (!permit) return json({ error: 'invalid_permit' }, 401);
  const spent = spentOn(requestsForPermit(permit.id), permit.rules.budget);
  return json({
    agent: permit.agentName,
    status: permit.status,
    purpose: permit.rules.purpose,
    owner_words: permit.sentence,
    rules: ruleChips(permit.rules).map((c) => c.label),
    spent: spent.toFixed(2),
    expires_at: permit.expiresAt,
  });
});
