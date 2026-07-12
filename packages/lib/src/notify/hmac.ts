/**
 * Solapi REST 인증 서명 (HMAC-SHA256).
 *
 * 스킴(Solapi 공식 문서):
 *   Authorization: HMAC-SHA256 apiKey={key}, date={ISO8601}, salt={random}, signature={hex}
 *   signature = HMAC-SHA256( message = date + salt, key = apiSecret )  → hex
 *
 * date 는 ISO8601, salt 는 재사용 금지 난수(12~64자). 순수 함수 — 테스트 결정성 위해
 * date/salt 를 주입 가능하게 분리.
 */
import { createHmac, randomBytes } from 'node:crypto';

export function makeSalt(): string {
  return randomBytes(32).toString('hex'); // 64 hex chars
}

export function solapiSignature(apiSecret: string, date: string, salt: string): string {
  return createHmac('sha256', apiSecret).update(date + salt).digest('hex');
}

export function solapiAuthHeader(
  apiKey: string,
  apiSecret: string,
  date: string = new Date().toISOString(),
  salt: string = makeSalt(),
): string {
  const signature = solapiSignature(apiSecret, date, salt);
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}
