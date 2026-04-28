/**
 * Sentry Client Init (Next.js 15+ 권장 위치).
 * DSN 비어있으면 silent — 가입 전에도 빌드 통과.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@mount/lib/error-reporting';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;
// dev 에서는 init skip — 매 요청 instrumentation 오버헤드 제거 (~93ms/req).
// SENTRY_DEV_ENABLED=1 로 강제 활성화 가능.
const enabled = !!dsn && (process.env.NODE_ENV === 'production' || process.env.SENTRY_DEV_ENABLED === '1');

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
