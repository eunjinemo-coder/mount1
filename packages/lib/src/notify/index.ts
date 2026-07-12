/**
 * @mount/lib/notify — 알림톡/SMS 발송 파이프라인(순수 코어 + env 로더).
 *
 * 사용처: apps/admin(입금확인·운송장 액션, 크론). apps/store 는 이 모듈을 import 하지 않고
 * DB RPC(enqueue_store_admin_new_order)만 호출 → Solapi 시크릿을 anon 앱에 두지 않는다.
 */
export type {
  StoreMessageTemplate,
  SendChannel,
  SendResult,
  MessageRow,
  NotifyVariables,
  EnqueueParams,
  MessageStore,
  Sender,
  SolapiConfig,
  StaticTextConfig,
} from './types';

export { maskPhone } from './redact';
export {
  ADMIN_RECIPIENT_SENTINEL,
  buildMessageText,
  isKnownTemplate,
  templateRecipient,
} from './templates';
export { solapiAuthHeader, solapiSignature, makeSalt } from './hmac';
export { createSolapiSender } from './solapi';
export type { FetchFn, SolapiSenderOptions } from './solapi';
export { enqueueMessage, flushMessage, flushPending } from './enqueue';
export type { FlushSummary } from './enqueue';
export { loadSolapiConfig, loadStaticTextConfig } from './config';
