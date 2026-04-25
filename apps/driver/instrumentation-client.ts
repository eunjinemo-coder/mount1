/**
 * Sentry Client Init (Next.js 15+ 권장 위치).
 * DSN 비어있으면 silent — 가입 전에도 빌드 통과.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@mount/lib/error-reporting';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_DRIVER;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Sampling (Phase 1 보수적 — egress·요금 통제)
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // PII scrub (PIPA + 헌법 제3조)
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
