/**
 * Sentry Client Init (Next.js 15+ 권장 위치).
 * DSN 비어있으면 silent — 가입 전에도 빌드 통과.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@mount/lib/error-reporting';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;

if (dsn) {
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
