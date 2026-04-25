/**
 * Analytics Wrapper — PostHog 직접 import 대신 본 모듈 경유.
 *
 * 정책 (05_TECH_STACK/06_EXTENSIBILITY §5.3 §7.2):
 *   · `import { analytics } from '@mount/lib/analytics'`
 *   · 미초기화 상태(KEY 없음) 에서 호출 → silent noop
 *   · client only — server 측 추적은 Phase 2 `posthog-node` 별도 도입
 *
 * 사용:
 *   1. apps/<app>/app/PostHogProvider.tsx 에서 `initAnalytics(...)` 1회 호출
 *   2. 이후 어디서든 `analytics.track('order.dispatched', {...})` 호출
 */

import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics(
  key: string | undefined,
  host: string | undefined,
): void {
  if (typeof window === 'undefined') return; // server-side 호출 보호
  if (!key || !host) return;
  if (initialized) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: false, // SPA 라우팅은 page() 로 수동 호출
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    loaded: () => {
      initialized = true;
    },
  });
}

export interface AnalyticsClient {
  track(event: string, props?: Record<string, unknown>): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
  page(name?: string, props?: Record<string, unknown>): void;
}

export const analytics: AnalyticsClient = {
  track(event, props) {
    if (typeof window === 'undefined' || !initialized) return;
    posthog.capture(event, props);
  },
  identify(userId, traits) {
    if (typeof window === 'undefined' || !initialized) return;
    posthog.identify(userId, traits);
  },
  reset() {
    if (typeof window === 'undefined' || !initialized) return;
    posthog.reset();
  },
  page(name, props) {
    if (typeof window === 'undefined' || !initialized) return;
    posthog.capture('$pageview', {
      ...(name ? { $current_url: name } : {}),
      ...props,
    });
  },
};
