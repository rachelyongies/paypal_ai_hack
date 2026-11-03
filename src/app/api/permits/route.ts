import { z } from 'zod';
import { permitsFor } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { issuePermit, RulesZ } from '@/lib/permits';
import { permitView } from '@/lib/serialize';
import { HttpError, requireOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const owner = await requireOwner();
  return json({ permits: permitsFor(owner.id).map((p) => permitView(p)) });
});

const Body = z.object({
  agentName: z.string().min(1).max(40),
  agentKind: z.enum(['demo', 'mcp', 'rest']),
  sentence: z.string().min(5).max(1200),
  rules: RulesZ,
  compiledBy: z.enum(['claude', 'rules']),
});

// Issue a permit. The token is returned exactly once and stored only as a hash.
export const POST = handle(async (req: Request) => {
  const owner = await requireOwner();
  const body = Body.parse(await req.json());
  if (permitsFor(owner.id).filter((p) => p.status !== 'revoked').length >= 12) throw new HttpError(400, 'Revoke an old permit first (12 active max).');
  const { permit, token } = issuePermit(owner, body);
  return json({ permit: permitView(permit), token }, 201);
});
