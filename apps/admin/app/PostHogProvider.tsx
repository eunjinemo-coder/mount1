'use client';

import { initAnalytics } from '@mount/lib/analytics';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

/**
 * PostHog 초기화 — admin 전용. KEY 미설정 시 silent noop.
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
