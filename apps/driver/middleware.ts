import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 기사앱 세션 가드 — 미로그인 시 /login redirect.
 * 헌법 제3조 Security-First.
 *
 * matcher 가 /api/health · 정적 자원은 자동 제외.
 * /login · /offline · / (marketing) 은 인증 없이 접근 가능 (publicPaths).
 */
const PUBLIC_PATHS = ['/login', '/offline'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true; // marketing
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // env 누락 시 안전 모드 (배포 전 설정 미흡 상황) — public path 만 허용
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

  // 세션 새로고침 (만료 토큰 자동 갱신)
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/health|sw.js).*)'],
};
