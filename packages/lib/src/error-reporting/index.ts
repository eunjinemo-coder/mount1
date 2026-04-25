/**
 * Error Reporting Wrapper — Sentry 직접 import 대신 본 모듈 경유.
 *
 * 정책 (05_TECH_STACK/06_EXTENSIBILITY §7.2):
 *   · 컴포넌트·서버 코드는 `import { captureError } from '@mount/lib/error-reporting'`
 *   · `import * as Sentry from '@sentry/nextjs'` 직접 호출 금지 (DataDog 등 교체 대비)
 *
 * 동작:
 *   · Sentry init 안 된 상태(DSN 없음) 에서 captureException 호출 → silent noop
 *   · 따라서 호출부는 안전하게 항상 호출 가능
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent, scrubText } from './scrubber';

export type BreadcrumbLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface Breadcrumb {
  message: string;
  category?: string;
  level?: BreadcrumbLevel;
  data?: Record<string, unknown>;
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: BreadcrumbLevel = 'info',
  context?: Record<string, unknown>,
): void {
  Sentry.captureMessage(scrubText(message), {
    level,
    ...(context ? { extra: context } : {}),
  });
}

export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  Sentry.addBreadcrumb({
    message: scrubText(breadcrumb.message),
    category: breadcrumb.category,
    level: breadcrumb.level,
    data: breadcrumb.data,
  });
}

/**
 * 사용자 컨텍스트 설정 (로그인 직후 호출 권장).
 * id 만 보냄 — 이름·전화 같은 PII 는 절대 보내지 않음.
 */
export function setUser(user: { id: string; role?: string } | null): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, ...(user.role ? { segment: user.role } : {}) });
}

export { scrubEvent, scrubText };
