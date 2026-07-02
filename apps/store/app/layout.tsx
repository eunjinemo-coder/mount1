import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { PostHogProvider } from './PostHogProvider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '벽걸이프로 스토어',
    template: '%s · 벽걸이프로 스토어',
  },
  description: '무타공 TV 벽걸이 브라켓 — 벽걸이프로 공식 스토어. (준비 중)',
  applicationName: '벽걸이프로 스토어',
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '벽걸이프로 스토어',
    title: '벽걸이프로 스토어',
    description: '무타공 TV 벽걸이 브라켓 — 벽걸이프로 공식 스토어.',
  },
  robots: {
    index: true,
    follow: true,
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
