import { handleRpc } from '@/lib/mcp';
import { bearer, permitFromToken } from '@/lib/permits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Accept',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function unauthorized() {
  return Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid Valet permit token. Send Authorization: Bearer vlt_sb_...' } },
    { status: 401, headers: { ...CORS, 'WWW-Authenticate': 'Bearer realm="valet"' } },
  );
}

// Streamable HTTP transport, JSON-response mode. Stateless: the permit token
// identifies the agent on every call.
export async function POST(req: Request) {
  const permit = permitFromToken(bearer(req));
  if (!permit) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS });
  }
  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object' || (m as { jsonrpc?: string }).jsonrpc !== '2.0') {
      replies.push({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
      continue;
    }
    const out = await handleRpc(permit, m as Parameters<typeof handleRpc>[1]);
    if (out) replies.push(out);
  }
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}

export async function GET() {
  // No server-initiated stream; clients fall back to request/response.
  return new Response('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST, DELETE, OPTIONS' } });
}

export async function DELETE() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
