import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

// QR codes for phone approvals, rendered as SVG.
export async function GET(req: Request) {
  const data = new URL(req.url).searchParams.get('d') ?? '';
  if (!data || data.length > 600) return new Response('Bad request', { status: 400 });
  const svg = await QRCode.toString(data, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#FFFFFF' }, errorCorrectionLevel: 'M' });
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } });
}
