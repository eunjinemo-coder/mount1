import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 관리자앱 세션 가드 — 미로그인 시 /login redirect.
 * 헌법 제3조 Security-First.
 *
 * IP whitelist (admin_users.ip_whitelist jsonb) 검증은 Phase 2 이관 — _DECISIONS.md 참조.
 * 현재는 세션 + role 페이지 가드 (페이지 Server Component requireRole) 이중 방어.
 */
const PUBLIC_PATHS = ['/login'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return false; // admin root 도 인증 필요
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isPublic(req.nextUrl.pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const response = NextResponse.next();
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
        for (const c of cookiesToSet) {
          response.cookies.set(c.name, c.value, c.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user && !isPublic(req.nextUrl.pathname)) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
