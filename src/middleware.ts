import { NextResponse, type NextRequest } from 'next/server';

// Every browser gets an anonymous owner id, so each judge gets their own
// Valet account without signing up. The id is an unguessable bearer secret.
export const OWNER_COOKIE = 'valet_owner';

export function middleware(req: NextRequest) {
  if (req.cookies.get(OWNER_COOKIE)?.value) return NextResponse.next();
  const ownerId = `own_${crypto.randomUUID().replace(/-/g, '')}`;
  // Make the id visible to this same request, then persist it.
  const headers = new Headers(req.headers);
  const existing = headers.get('cookie');
  headers.set('cookie', `${existing ? existing + '; ' : ''}${OWNER_COOKIE}=${ownerId}`);
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(OWNER_COOKIE, ownerId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.well-known|api/agent|api/mcp|api/webhooks).*)'],
};
