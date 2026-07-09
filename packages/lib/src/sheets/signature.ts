/**
 * 웹훅 서명 — Apps Script → 웹훅 공유시크릿 HMAC-SHA256 (§2.1 · §2.5).
 *
 * Apps Script 가 요청 본문(raw JSON 문자열)을 SHEETS_WEBHOOK_SECRET 로 HMAC-SHA256 →
 * hex 서명해 헤더로 보낸다. 웹훅은 같은 계산 후 상수시간 비교. 불일치 → 401(미반영).
 *
 * 상수시간 비교로 타이밍 사이드채널 차단. 길이 다르면 즉시 false(비교 전 노출 회피).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SHEETS_SIGNATURE_HEADER = 'x-sheets-signature';

/** 본문(raw 문자열)에 대한 서명 hex. Apps Script 와 동일 알고리즘. */
export function sheetsSignature(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** 제공서명이 유효한지 상수시간 검증. */
export function verifySheetsSignature(
  secret: string,
  rawBody: string,
  provided: string | null | undefined,
): boolean {
  if (!secret || secret.length === 0) return false;
  if (!provided || provided.length === 0) return false;
  const expected = sheetsSignature(secret, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
