import withSerwistInit from '@serwist/next';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
});

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
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            // CSP — P1-S3 (3차 보안 검증) 해소
            // Supabase · Sentry · PostHog · Kakao Maps 호스트 허용. 'unsafe-inline' 은 Next.js
            // hydration 데이터 + Tailwind CSS 인라인을 위해 필요 (Phase 2 nonce 기반으로 강화).
            // 'unsafe-eval' 은 dev 모드에서만 허용 (React dev runtime 요구) — prod 는 제거하여 보안 강화.
            // Sentry region prefix(us/de) 은 wildcard 1단계 매칭 한계로 명시 추가.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://*.posthog.com https://browser.sentry-cdn.com https://*.kakao.com https://dapi.kakao.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://*.posthog.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://dapi.kakao.com",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
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
export default withSentryConfig(withSerwist(nextConfig), {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_DRIVER,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: false },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
