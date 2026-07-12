/* eslint-disable no-console -- logger 래퍼: 유일하게 console 사용이 허용된 파일.
 * Sentry 통합 완료 — error/warn 은 Sentry breadcrumb·exception 으로 전송.
 * 참조: 05_TECH_STACK/05_DEVOPS_MONITORING.md, 06_EXTENSIBILITY §10 */

import { addBreadcrumb, captureError, scrubEvent, scrubText } from './error-reporting';

type LogPayload = Record<string, unknown>;

function stamp(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level}] ${message}`;
}

/**
 * FIX-C: console(stdout/Vercel 로그) 로 나가는 인자에서 PII(휴대폰·이메일) 마스킹.
 * Sentry 경로(breadcrumb/captureError)는 beforeSend 의 scrubEvent 가 이미 처리하므로,
 * 스크럽 누락 구간은 console 출력뿐. 외부 응답(예: Solapi 에러 메시지)이 수신번호를 에코해도
 * stdout 에 평문이 남지 않도록 warn/error 의 message·payload 를 여기서 스크럽한다.
 */
function scrubPayload(payload?: LogPayload): LogPayload {
  return payload ? (scrubEvent(payload) as LogPayload) : {};
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
    console.warn(stamp('warn', scrubText(message)), scrubPayload(payload));
    addBreadcrumb({
      message,
      category: 'log',
      level: 'warning',
      data: payload,
    });
  },

  error(message: string, error?: unknown, payload?: LogPayload): void {
    // error 객체 message 도 스크럽(Error.message 는 Object.entries 로 안 잡히므로 문자열화 후 스크럽)
    const scrubbedError =
      error instanceof Error ? scrubText(error.message) : scrubEvent(error);
    console.error(stamp('error', scrubText(message)), scrubbedError, scrubPayload(payload));
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
