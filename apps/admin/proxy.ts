import { matchAnyCidr } from '@mount/lib';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 관리자앱 세션 가드 — 미로그인 시 /login redirect.
 * 헌법 제3조 Security-First.
 *
 * IP whitelist (admin_users.ip_whitelist jsonb) 검증 — 인증 후 적용.
 * 빈 배열 또는 미등록 = 모든 IP 허용 (운영 진입 전 fallback). 운영 시작 전 등록 권장.
 * IPv6 는 Phase 2 — _HANDOFF_PHASE2.md §3 참조.
 */
const PUBLIC_PATHS = ['/login'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return false; // admin root 도 인증 필요
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getClientIp(req: NextRequest): string | null {
  // Vercel/Cloudflare 등 신뢰된 프록시: x-forwarded-for 첫 값 = 클라 IP.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  return realIp ?? null;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
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

  // IP whitelist 검증 — 인증된 사용자에 대해서만, 공개 경로는 스킵.
  if (user && !isPublic(req.nextUrl.pathname)) {
    try {
      const { data: adminRow } = await client
        .from('admin_users')
        .select('ip_whitelist')
        .eq('user_id', user.id)
        .maybeSingle();

      // admin_users 미등록 = 인증은 됐으나 어드민 권한 없음 → 차단 (페이지 단 requireRole 보강).
      if (adminRow === null) {
        const blocked = new URL('/login', req.url);
        blocked.searchParams.set('error', 'forbidden');
        return NextResponse.redirect(blocked);
      }

      const raw = adminRow.ip_whitelist;
      const whitelist: string[] = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === 'string')
        : [];

      // 빈 배열 = 운영 진입 전 fallback (모든 IP 허용). 등록된 항목이 있을 때만 강제.
      if (whitelist.length > 0) {
        const ip = getClientIp(req);
        if (!ip || !matchAnyCidr(ip, whitelist)) {
          const blocked = new URL('/login', req.url);
          blocked.searchParams.set('error', 'ip_blocked');
          return NextResponse.redirect(blocked);
        }
      }
    } catch (err) {
      // admin_users 조회 실패 — 페이지 단 requireRole 이 2차 방어.
      // 미들웨어 차단 시 DB 장애 중 정상 계정도 잠겨 운영 위험 → fail-open 유지하되 로그 확보.
      console.error('[proxy] admin_users fetch failed', err);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
