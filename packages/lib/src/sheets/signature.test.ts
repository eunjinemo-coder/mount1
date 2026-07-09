import { describe, expect, it } from 'vitest';
import { sheetsSignature, verifySheetsSignature } from './signature';

const SECRET = 'test-webhook-secret-0123456789abcdef';
const BODY = JSON.stringify({ syncRowId: 'u', values: ['a', 'b'] });

describe('verifySheetsSignature — 웹훅 서명(§2.1)', () => {
  it('올바른 서명 → true', () => {
    const sig = sheetsSignature(SECRET, BODY);
    expect(verifySheetsSignature(SECRET, BODY, sig)).toBe(true);
  });

  it('본문 변조 → false(무결성)', () => {
    const sig = sheetsSignature(SECRET, BODY);
    expect(verifySheetsSignature(SECRET, BODY + 'x', sig)).toBe(false);
  });

  it('시크릿 불일치 → false(401 경로)', () => {
    const sig = sheetsSignature(SECRET, BODY);
    expect(verifySheetsSignature('wrong-secret', BODY, sig)).toBe(false);
  });

  it('서명 누락/빈값 → false', () => {
    expect(verifySheetsSignature(SECRET, BODY, null)).toBe(false);
    expect(verifySheetsSignature(SECRET, BODY, '')).toBe(false);
    expect(verifySheetsSignature(SECRET, BODY, undefined)).toBe(false);
  });

  it('시크릿 미설정 → false(운영 필수)', () => {
    expect(verifySheetsSignature('', BODY, sheetsSignature(SECRET, BODY))).toBe(false);
  });

  it('길이 다른 서명 → false(상수시간 비교 전 차단)', () => {
    expect(verifySheetsSignature(SECRET, BODY, 'short')).toBe(false);
  });
});
