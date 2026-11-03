import { opsView } from '@/lib/serialize';
import { sseResponse } from '@/lib/stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Live feed for the Risk Ops console: every agent payment across all owners.
export async function GET(req: Request) {
  return sseResponse(req, 'ops', (e) => {
    if (e.type === 'request') return { event: 'request', data: opsView(e.request) };
    if (e.type === 'webhook') return { event: 'webhook', data: { eventType: e.eventType } };
    return null;
  });
}
