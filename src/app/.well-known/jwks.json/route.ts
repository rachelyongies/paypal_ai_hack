import { jwks } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await jwks(), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
