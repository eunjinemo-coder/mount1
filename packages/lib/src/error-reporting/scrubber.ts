/**
 * PII Scrubber — 한국 시장 휴대폰·이메일 자동 마스킹.
 *
 * Sentry beforeSend 에서 호출되어 에러 message · exception.value · request.cookies 등에서
 * 개인정보(PII)를 별표로 치환. PIPA 준수 + 헌법 제3조 Security-First.
 *
 * 적용 범위:
 *   · 한국 휴대폰: 010-1234-5678 / 01012345678 / +82-10-1234-5678 형태
 *   · 일반 이메일: name@host.tld
 *
 * 적용 외 (의도적):
 *   · 일반 전화 (02-, 031- 등) — 사업장 번호는 PII 위험 낮음
 *   · 주민번호·계좌번호 — 본 시스템에서 수집 안 함 (헌법 제3조 위반)
 */

const PHONE_REGEX = /(?:\+?82-?\s?)?0?1[0-9][\s-]?\d{3,4}[\s-]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubText(text: string): string {
  if (!text) return text;
  return text.replace(PHONE_REGEX, '***-****-****').replace(EMAIL_REGEX, '****@****');
}

/**
 * Sentry Event 객체 재귀 스크럽.
 * message · exception.values[].value · request.url(querystring 일부) 까지 처리.
 * generic T 그대로 반환 — ErrorEvent · TransactionEvent · 임의 객체 모두 호환.
 */
export function scrubEvent<T>(event: T): T {
  if (!event) return event;
  return walk(event) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  }
  return value;
}
