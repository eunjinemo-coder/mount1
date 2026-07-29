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

// IP whitelist 60초 캐시 — 매 네비게이션마다 admin_users 왕복하지 않게(변경은 1분 내 반영).
const WHITELIST_TTL_MS = 60_000;
const whitelistCache = new Map<string, { at: number; found: boolean; whitelist: string[] }>();

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

  // 성능: getUser()(매 요청 Supabase Auth 네트워크 왕복) 대신 getSession()(쿠키 로컬 파싱).
  // 미들웨어의 역할은 UX 리다이렉트일 뿐 — 실제 보안 집행은 페이지 requireRole(서버 검증)
  // + RLS(DB) 이중 방어가 담당하므로 위조 토큰은 데이터에 닿기 전에 걸러진다.
  const {
    data: { session },
  } = await client.auth.getSession();
  const user = session?.user ?? null;

  if (!user && !isPublic(req.nextUrl.pathname)) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // IP whitelist 검증 — 인증된 사용자에 대해서만, 공개 경로는 스킵. 60초 캐시로 DB 왕복 절감.
  if (user && !isPublic(req.nextUrl.pathname)) {
    try {
      let entry = whitelistCache.get(user.id);
      if (!entry || Date.now() - entry.at > WHITELIST_TTL_MS) {
        const { data: adminRow } = await client
          .from('admin_users')
          .select('ip_whitelist')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        const raw = adminRow?.ip_whitelist;
        entry = {
          at: Date.now(),
          found: adminRow !== null,
          whitelist: Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [],
        };
        whitelistCache.set(user.id, entry);
      }

      // admin_users 미등록 = 인증은 됐으나 어드민 권한 없음 → 차단 (페이지 단 requireRole 보강).
      if (!entry.found) {
        const blocked = new URL('/login', req.url);
        blocked.searchParams.set('error', 'forbidden');
        return NextResponse.redirect(blocked);
      }

      const whitelist = entry.whitelist;

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

// api/sheets-webhook(구글 Apps Script HMAC 인증) · api/cron(CRON_SECRET) 은 세션이 없으므로
// 미들웨어 세션 가드에서 제외한다(각 라우트가 자체 인증). 제외 안 하면 /login 으로 307 리다이렉트돼
// 외부 웹훅/크론이 처리기에 도달하지 못한다.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|api/sheets-webhook|api/cron).*)'],
};
