import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mount/ui', '@mount/lib'],
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
            // driver/admin 과 달리 Supabase·Kakao Maps 미사용 (R1 은 더미 데이터 전용) —
            // 실제 주문 연동(R3) 시 connect-src 에 Supabase 호스트 추가 예정.
            // dev 에서만 'unsafe-eval' 허용 — React dev runtime (콜스택 재구성·HMR) 요구.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://*.posthog.com https://browser.sentry-cdn.com`,
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https://*.posthog.com",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              "connect-src 'self' https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
              "media-src 'self' blob:",
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
