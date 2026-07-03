import 'server-only'; // FIX-D: 발신자격증명·HMAC 서명·아웃바운드 발송 코드 — 클라 유입 차단.

/**
 * Solapi 발송 어댑터 — 카카오 알림톡(ATA) 우선 + SMS/LMS 폴백.
 * (자격증명은 SolapiConfig 로 주입받는다 — 이 모듈 자체는 env 를 읽지 않음. 시크릿 리더는 config.ts)
 *
 * 정책(은진님 2026-07-03):
 *   · 승인 template id 가 있으면 ATA 시도 → 실패(미승인·수신거부 등) 시 SMS/LMS 로 폴백.
 *   · template id 가 아직 없으면(심사 전 베타) 곧장 SMS/LMS 로 발송.
 *   · admin 수신은 센티넬('__admin__')을 env 실번호(config.adminPhone)로 치환 —
 *     anon 이 수신번호를 조종하는 경로를 원천 차단(SMS 비용폭탄 방지).
 *
 * fetch/date/salt 를 주입 가능하게 하여 단위 테스트가 실 네트워크 없이 검증한다.
 * 전화 원문은 절대 로그/에러 문자열에 담지 않는다(호출측 redact.maskPhone 사용).
 */
import { solapiAuthHeader } from './hmac';
import { ADMIN_RECIPIENT_SENTINEL, buildMessageText, templateRecipient } from './templates';
import type {
  MessageRow,
  NotifyVariables,
  SendChannel,
  SendResult,
  Sender,
  SolapiConfig,
  StaticTextConfig,
  StoreMessageTemplate,
} from './types';

const SOLAPI_SEND_ENDPOINT = 'https://api.solapi.com/messages/v4/send';

export type FetchFn = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface SolapiSenderOptions {
  fetchFn?: FetchFn;
  now?: () => string; // ISO date (테스트 결정성)
  makeSalt?: () => string;
}

/** EUC-KR 근사 바이트 길이(한글 2, 그 외 1)로 SMS(≤90) vs LMS 판정. */
function smsChannel(text: string): 'SMS' | 'LMS' {
  let bytes = 0;
  for (const ch of text) bytes += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return bytes <= 90 ? 'SMS' : 'LMS';
}

/** 템플릿 변수 → Solapi 알림톡 치환형(#{key}). 값은 문자열화. */
function kakaoVariables(vars: NotifyVariables): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) continue;
    out[`#{${k}}`] = String(v);
  }
  return out;
}

interface SolapiMessage {
  to: string;
  from: string;
  type: SendChannel;
  text: string;
  kakaoOptions?: {
    pfId: string;
    templateId: string;
    variables: Record<string, string>;
    disableSms: boolean;
  };
}

/** 응답 해석: HTTP 2xx + (statusCode 없음 또는 '2'로 시작) 이면 접수 성공으로 간주. */
function interpret(
  ok: boolean,
  body: unknown,
): { accepted: boolean; providerMessageId?: string; error?: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const statusCode = typeof b.statusCode === 'string' ? b.statusCode : undefined;
  const messageId = typeof b.messageId === 'string' ? b.messageId : undefined;
  if (!ok) {
    const msg =
      (typeof b.errorMessage === 'string' && b.errorMessage) ||
      (typeof b.message === 'string' && b.message) ||
      'http_error';
    return { accepted: false, error: String(msg) };
  }
  if (statusCode && !statusCode.startsWith('2')) {
    const msg =
      (typeof b.statusMessage === 'string' && b.statusMessage) || `status_${statusCode}`;
    return { accepted: false, error: msg };
  }
  return { accepted: true, providerMessageId: messageId };
}

export function createSolapiSender(
  config: SolapiConfig,
  textConfig: StaticTextConfig,
  options: SolapiSenderOptions = {},
): Sender {
  const fetchFn = options.fetchFn ?? (globalThis.fetch as unknown as FetchFn);

  async function post(message: SolapiMessage): Promise<SendResult> {
    const date = options.now?.() ?? new Date().toISOString();
    const salt = options.makeSalt?.();
    const authorization = salt
      ? solapiAuthHeader(config.apiKey, config.apiSecret, date, salt)
      : solapiAuthHeader(config.apiKey, config.apiSecret, date);
    let res: Awaited<ReturnType<FetchFn>>;
    try {
      res = await fetchFn(SOLAPI_SEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* 본문 파싱 실패는 status 로만 판정 */
    }
    const r = interpret(res.ok, body);
    return r.accepted
      ? { ok: true, channel: message.type, providerMessageId: r.providerMessageId }
      : { ok: false, channel: message.type, error: r.error };
  }

  return {
    async send(row: MessageRow): Promise<SendResult> {
      const recipient = templateRecipient(row.template);
      if (recipient === null) {
        return { ok: false, error: `unknown_template:${row.template}` };
      }

      // 수신번호 확정 — admin 센티넬은 env 실번호로 치환. anon 주입 차단의 핵심.
      const to =
        recipient === 'admin' || row.toPhone === ADMIN_RECIPIENT_SENTINEL
          ? config.adminPhone
          : row.toPhone.replace(/\D/g, '');
      if (!to) return { ok: false, error: 'no_recipient' };

      const text = buildMessageText(row.template, row.variables, textConfig);
      if (!text) return { ok: false, error: `no_text:${row.template}` };

      const templateId = config.templateIds[row.template as StoreMessageTemplate];

      // (1) 승인 template id 가 있으면 ATA(알림톡) 먼저.
      if (templateId) {
        const ata = await post({
          to,
          from: config.sender,
          type: 'ATA',
          text, // disableSms=false 시 폴백 본문으로도 쓰임
          kakaoOptions: {
            pfId: config.pfId,
            templateId,
            variables: kakaoVariables(row.variables),
            disableSms: false,
          },
        });
        if (ata.ok) return ata;
        // ATA 실패 → 명시적 SMS/LMS 폴백(아래로 진행)
      }

      // (2) SMS/LMS 폴백(또는 베타: template id 미설정).
      return post({ to, from: config.sender, type: smsChannel(text), text });
    },
  };
}
