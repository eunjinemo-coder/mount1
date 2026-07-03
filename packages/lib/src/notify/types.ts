/**
 * 알림톡/SMS 발송 도메인 타입.
 *
 * 순수 타입만 — Next/DB/서버 전용 import 없음(단위 테스트가 그대로 임포트 가능).
 * 발송 파이프라인은 DI 로 구성한다:
 *   enqueue/flush(MessageStore) · send(Sender) · text(StaticTextConfig) · 서명(SolapiConfig)
 */

/** store_message_log.template 에 저장되는 P0 템플릿 키. */
export type StoreMessageTemplate =
  | 'new_order_admin' // 신규주문 → 은진님(admin). 수신번호 = 센티넬 '__admin__'
  | 'payment_confirmed' // 입금확인 → 구매자
  | 'shipped' // 운송장 등록 → 구매자
  | 'payment_reminder'; // 입금기한 24h 전 → 구매자

/** 실제 발송 채널. ATA=카카오 알림톡, SMS(≤90byte)/LMS(>90byte)=문자 폴백. */
export type SendChannel = 'ATA' | 'SMS' | 'LMS';

export interface SendResult {
  ok: boolean;
  channel?: SendChannel;
  providerMessageId?: string;
  /** 실패 사유(내부용). 전화 원문 등 PII 를 담지 않는다. */
  error?: string;
}

/** store_message_log 한 행(발송 재시도의 자체완결 단위). */
export interface MessageRow {
  id: string;
  dedupeKey: string;
  orderId: string | null;
  template: string;
  toPhone: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  variables: NotifyVariables;
}

/** 템플릿 치환 변수. 값은 문자열/숫자만(직렬화 안전). */
export type NotifyVariables = Record<string, string | number | null | undefined>;

export interface EnqueueParams {
  dedupeKey: string;
  orderId: string | null;
  template: StoreMessageTemplate;
  /** 구매자 발송 = 실수신번호(숫자). admin 발송 = 센티넬 '__admin__'. */
  toPhone: string;
  variables: NotifyVariables;
}

/**
 * DB 접근 추상화 — 구현은 admin/cron 이 supabase 클라이언트로 주입(테스트는 mock).
 * insertPending 은 dedupe_key unique 충돌 시 no-op(멱등) → { inserted:false }.
 */
export interface MessageStore {
  insertPending(p: EnqueueParams): Promise<{ inserted: boolean }>;
  /** status pending|failed(attempts<3) 재발송 대상. */
  listRetryable(limit: number): Promise<MessageRow[]>;
  markSent(id: string, channel?: SendChannel, providerMessageId?: string): Promise<void>;
  /** attempts += 1, last_error 기록, status='failed'. */
  markFailed(id: string, error: string): Promise<void>;
}

/** 발송 어댑터 — Solapi 구현 또는 테스트 stub. */
export interface Sender {
  send(row: MessageRow): Promise<SendResult>;
}

/** Solapi 자격증명 + 템플릿 매핑(env 유래). templateIds 미설정 시 SMS/LMS 직접발송(베타). */
export interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  /** 발신번호(사전 등록). */
  sender: string;
  /** 카카오 채널 pfId. */
  pfId: string;
  /** admin 알림 실수신번호(은진님). '__admin__' 센티넬을 이 번호로 치환. */
  adminPhone: string;
  templateIds: Partial<Record<StoreMessageTemplate, string>>;
}

/** SMS/알림톡 본문에 병합되는 정적 정보(계좌·브랜드·조회링크). */
export interface StaticTextConfig {
  brand: string;
  bankInfo: string;
  /** 주문조회 페이지 절대 URL(예: https://store.mountpartners.cloud/order/lookup). */
  lookupUrl: string;
}
