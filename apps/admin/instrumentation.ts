/**
 * Next.js Instrumentation — server + edge 런타임 에러 보고.
 * Client 측 init 은 ./instrumentation-client.ts 가 담당.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@mount/lib/error-reporting';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_ADMIN;

export async function register(): Promise<void> {
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      beforeSend: (event) => scrubEvent(event),
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      beforeSend: (event) => scrubEvent(event),
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
