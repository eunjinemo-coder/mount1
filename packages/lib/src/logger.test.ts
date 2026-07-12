import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// error-reporting 이 @sentry/nextjs 를 import → node 테스트에서 noop 으로 대체(실 scrub 은 유지).
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}));

const { log } = await import('./logger');

describe('log — FIX-C console PII 스크럽', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('warn: payload 내 휴대폰(외부응답 에코 포함)이 마스킹된다', () => {
    log.warn('store notify best-effort 실패', {
      to: '010-1234-5678',
      error: 'delivery failed for 01098765432',
    });
    const serialized = JSON.stringify(warnSpy.mock.calls[0]);
    expect(serialized).not.toContain('1234-5678');
    expect(serialized).not.toContain('01098765432');
  });

  it('error: message·error객체·payload 전부 마스킹', () => {
    log.error('오류 010-1111-2222', new Error('phone 01033334444'), { p: '010-5555-6666' });
    const serialized = JSON.stringify(errorSpy.mock.calls[0]);
    expect(serialized).not.toContain('1111-2222');
    expect(serialized).not.toContain('01033334444');
    expect(serialized).not.toContain('5555-6666');
  });
});
