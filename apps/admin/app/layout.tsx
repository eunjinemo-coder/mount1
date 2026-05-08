import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { PostHogProvider } from './PostHogProvider';

// admin은 모든 페이지가 RLS + 세션 의존 — build time prerender 비활성화.
// 빌드 시 env 부재로 prerender 깨지는 문제 회피.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: '마운트파트너스 관리자',
    template: '%s · 관리자',
  },
  description: '마운트파트너스 운영 관리자 콘솔',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
