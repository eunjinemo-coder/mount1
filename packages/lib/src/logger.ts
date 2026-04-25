/* eslint-disable no-console -- logger 래퍼: 유일하게 console 사용이 허용된 파일.
 * Sentry 통합 완료 — error/warn 은 Sentry breadcrumb·exception 으로 전송.
 * 참조: 05_TECH_STACK/05_DEVOPS_MONITORING.md, 06_EXTENSIBILITY §10 */

import { addBreadcrumb, captureError } from './error-reporting';

type LogPayload = Record<string, unknown>;

function stamp(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level}] ${message}`;
}

const isProd = process.env.NODE_ENV === 'production';

export const log = {
  info(message: string, payload?: LogPayload): void {
    if (!isProd) console.info(stamp('info', message), payload ?? {});
    addBreadcrumb({
      message,
      category: 'log',
      level: 'info',
      data: payload,
    });
  },

  warn(message: string, payload?: LogPayload): void {
    console.warn(stamp('warn', message), payload ?? {});
    addBreadcrumb({
      message,
      category: 'log',
      level: 'warning',
      data: payload,
    });
  },

  error(message: string, error?: unknown, payload?: LogPayload): void {
    console.error(stamp('error', message), error, payload ?? {});
    captureError(error ?? new Error(message), {
      logMessage: message,
      ...payload,
    });
  },

  debug(message: string, payload?: LogPayload): void {
    if (!isProd) {
      console.debug(stamp('debug', message), payload ?? {});
      addBreadcrumb({
        message,
        category: 'log',
        level: 'debug',
        data: payload,
      });
    }
  },
};
