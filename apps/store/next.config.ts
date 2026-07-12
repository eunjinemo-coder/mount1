import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// Supabase 호스트를 env 에서 파생 — CSP connect-src 에 정확한 오리진 추가용.
// 파싱 실패/미설정 시 빈 문자열 → *.supabase.co 폴백만 적용.
const SUPABASE_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mount/ui', '@mount/lib', '@mount/db'],
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            // CSP — store 는 공개 스토어프론트 (검색엔진·카카오톡 링크 미리보기 대상).
            // R3 주문 연동: 주문/조회/견적은 server action(동일 출처)으로 Supabase 를 호출하므로
            // 브라우저 직접 호출은 없지만, 향후 클라이언트 측 Supabase 호출 대비 + 방어적으로
            // connect-src 에 Supabase 호스트를 추가한다(env 파생 + *.supabase.co 폴백).
            // dev 에서만 'unsafe-eval' 허용 — React dev runtime (콜스택 재구성·HMR) 요구.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 다음(카카오) 우편번호: 스크립트 t1.daumcdn.net · 임베드 iframe/에셋 *.daum.net·*.daumcdn.net
              // 트레이드오프: 벤더가 SRI 해시·고정 서브도메인을 보장하지 않아 와일드카드(*.daumcdn.net) 허용.
              // 무료·키 불요 공식 서비스로 오타 없는 주소 입력 이득이 크고, 스크립트는 클릭 시에만 온디맨드 로드.
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://*.posthog.com https://browser.sentry-cdn.com https://*.daumcdn.net`,
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https://*.posthog.com https://*.daumcdn.net https://*.daum.net",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              `connect-src 'self' https://*.supabase.co${SUPABASE_HOST ? ` ${SUPABASE_HOST}` : ''} https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.daum.net https://*.daumcdn.net`,
              "media-src 'self' blob:",
              "frame-src 'self' https://*.daum.net https://*.daumcdn.net",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Sentry source map 업로드는 SENTRY_AUTH_TOKEN 있을 때만 작동.
// authToken 없으면 build 는 통과 + 업로드만 skip.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_STORE,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: false },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
