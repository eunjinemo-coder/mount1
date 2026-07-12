/**
 * 발송 로그용 PII 마스킹. 전화 원문을 로그/Sentry 에 절대 남기지 않기 위함(PRD §7).
 *
 * error-reporting/scrubText 는 자유 텍스트 전체를 훑는 무거운 정규식이고, 여기서는
 * "이미 전화번호임을 아는 단일 값"을 뒷 4자리만 남겨 마스킹하는 가벼운 헬퍼가 필요하다.
 */

/** 01012345678 → ***-****-5678. 센티넬('__admin__')·빈값은 라벨만 반환. */
export function maskPhone(raw: string | null | undefined): string {
  if (!raw) return '(none)';
  if (raw === '__admin__') return '(admin)';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-****-${digits.slice(-4)}`;
}
