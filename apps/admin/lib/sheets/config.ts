import 'server-only';

/**
 * 시트 동기화 env 로더 (서버 전용). 시크릿(서비스계정 개인키·웹훅 시크릿)을 다루므로
 * 클라이언트 번들 유입 시 server-only 가 빌드차단.
 *
 * · GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY : 시트 API JWT 자격(은진님 시트에 편집자 공유)
 * · SHEETS_WEBHOOK_SECRET                       : Apps Script ↔ 웹훅 공유 HMAC 시크릿
 *
 * 미설정 시 각 로더가 throw → 워커/웹훅 route 가 잡아 503/로깅(동기화만 중단, 앱은 정상).
 */
export interface GoogleServiceAccount {
  readonly email: string;
  readonly privateKey: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`${name} is required for sheets sync`);
  }
  return v.trim();
}

export function loadGoogleServiceAccount(): GoogleServiceAccount {
  const email = required('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  // env 에는 개행이 \n 리터럴로 저장되는 관례 → 실제 개행으로 복원.
  const privateKey = required('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
  return { email, privateKey };
}

export function loadWebhookSecret(): string {
  return required('SHEETS_WEBHOOK_SECRET');
}

/** 웹훅 시크릿 존재 여부(설정 안내 UI 용 · 값 노출 없음). */
export function hasWebhookSecret(): boolean {
  const v = process.env.SHEETS_WEBHOOK_SECRET;
  return !!v && v.trim().length > 0;
}

/** 서비스계정 설정 여부(설정 안내 UI 용). */
export function hasGoogleServiceAccount(): boolean {
  return (
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  );
}
