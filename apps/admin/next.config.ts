import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mount/ui', '@mount/lib', '@mount/db'],
  typedRoutes: true,
  experimental: {
    // 시공 사진 업로드는 서버액션 FormData 로 최대 10MB 파일 전송(multipart 오버헤드 여유 포함).
    // 기본 1MB 로는 폰 사진이 막힘 → 12MB 로 상향(uploadInstallationPhotoAction 의 MAX_BYTES=10MB 와 정합).
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
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
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          {
            // CSP — admin 은 driver 보다 더 엄격 (외부 unsafe-eval 제거 + 더 좁은 host)
            // dev 에서만 'unsafe-eval' 허용 — React dev runtime (콜스택 재구성·HMR) 요구.
            // jsdelivr: Pretendard 폰트 CDN. Kakao: /live 지도 SDK (admin도 driver와 동일 host 허용).
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://*.posthog.com https://browser.sentry-cdn.com https://*.kakao.com https://dapi.kakao.com`,
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https://*.supabase.co https://*.daumcdn.net",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://dapi.kakao.com",
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

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_ADMIN,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: false },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
