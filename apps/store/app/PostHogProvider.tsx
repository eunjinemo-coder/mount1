'use client';

import { initAnalytics } from '@mount/lib/analytics';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

/**
 * PostHog 초기화 + SPA 라우트 변경 시 page() 자동 호출.
 * KEY 미설정 시 silent noop — 빌드·런타임 안전.
 */
export function PostHogProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    initAnalytics(
      process.env.NEXT_PUBLIC_POSTHOG_KEY,
      process.env.NEXT_PUBLIC_POSTHOG_HOST,
    );
  }, []);

  return children;
}
