import { currentOwner } from '@/lib/session';
import { sseResponse } from '@/lib/stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Live updates for the owner's dashboard and phone approvals.
export async function GET(req: Request) {
  const owner = await currentOwner();
  if (!owner) return new Response('No session', { status: 401 });
  return sseResponse(req, `owner:${owner.id}`, (e) => {
    if (e.type === 'request') return { event: 'request', data: e.request };
    if (e.type === 'permit') {
      const { tokenHash: _t, ...p } = e.permit;
      return { event: 'permit', data: p };
    }
    if (e.type === 'owner') return { event: 'owner', data: {} };
    return null;
  });
}

