/* eslint-disable no-console -- logger 래퍼: 유일하게 console 사용이 허용된 파일.
 * Sentry + Better Stack 통합 시 console 의존성 제거 예정.
 * 참조: 05_TECH_STACK/05_DEVOPS_MONITORING.md, _CLAUDE_CODE_KICKOFF.md §14 */

type LogPayload = Record<string, unknown>;

function stamp(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level}] ${message}`;
}

export const log = {
  info(message: string, payload?: LogPayload): void {
    console.info(stamp('info', message), payload ?? {});
  },
  warn(message: string, payload?: LogPayload): void {
    console.warn(stamp('warn', message), payload ?? {});
  },
  error(message: string, error?: unknown, payload?: LogPayload): void {
    // TODO: Sentry.captureException(error, { extra: { message, ...payload } })
    console.error(stamp('error', message), error, payload ?? {});
  },
  debug(message: string, payload?: LogPayload): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(stamp('debug', message), payload ?? {});
    }
  },
};
