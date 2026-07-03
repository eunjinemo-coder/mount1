import 'server-only'; // FIX-D: SOLAPI_API_SECRET 등 시크릿 리더 — 클라 번들 유입 시 빌드차단.

/**
 * env → SolapiConfig / StaticTextConfig 로더 (서버 전용).
 *
 * 서버(admin actions·크론)에서만 호출된다. 시크릿(SOLAPI_API_SECRET 등)을 다루므로
 * 클라이언트 컴포넌트에서 import 하지 말 것. server-only 가드로 실수 방지.
 *
 * template id 는 미설정 허용(심사 전 베타 → SMS/LMS 직접발송). 필수는 자격증명·발신·수신뿐.
 */
import type { SolapiConfig, StaticTextConfig, StoreMessageTemplate } from './types';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return v.trim();
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * SOLAPI_* env 로 SolapiConfig 구성.
 * 필수: API_KEY / API_SECRET / SENDER_PHONE / PFID / ADMIN_PHONE.
 * 선택: TPL_* (미설정 시 해당 템플릿은 SMS/LMS 직접발송).
 */
export function loadSolapiConfig(): SolapiConfig {
  const templateIds: Partial<Record<StoreMessageTemplate, string>> = {};
  const newOrder = optional('SOLAPI_TPL_NEW_ORDER');
  const paid = optional('SOLAPI_TPL_PAYMENT_CONFIRMED');
  const shipped = optional('SOLAPI_TPL_SHIPPED');
  const reminder = optional('SOLAPI_TPL_PAYMENT_REMINDER');
  if (newOrder) templateIds.new_order_admin = newOrder;
  if (paid) templateIds.payment_confirmed = paid;
  if (shipped) templateIds.shipped = shipped;
  if (reminder) templateIds.payment_reminder = reminder;

  return {
    apiKey: required('SOLAPI_API_KEY'),
    apiSecret: required('SOLAPI_API_SECRET'),
    sender: required('SOLAPI_SENDER_PHONE').replace(/\D/g, ''),
    pfId: required('SOLAPI_PFID'),
    adminPhone: required('SOLAPI_ADMIN_PHONE').replace(/\D/g, ''),
    templateIds,
  };
}

/** 본문 병합용 정적 정보. 미설정 시 안전한 플레이스홀더(발송은 되게). */
export function loadStaticTextConfig(): StaticTextConfig {
  const site = optional('NEXT_PUBLIC_SITE_URL') ?? 'https://store.mountpartners.cloud';
  return {
    brand: '🛠 벽걸이프로',
    bankInfo: optional('STORE_BANK_INFO') ?? '주문완료 안내 참조',
    lookupUrl: `${site.replace(/\/$/, '')}/order/lookup`,
  };
}
