/**
 * P0 스토어 알림 템플릿 — 수신자 구분 + SMS/LMS 폴백 본문 생성.
 *
 * 카카오 알림톡 템플릿이 아직 심사 전(베타)일 수 있으므로, 승인 template id 가 없으면
 * 여기 본문으로 SMS/LMS 를 직접 발송한다(발송 자체는 승인 전에도 동작). 승인 후에는
 * 알림톡(ATA) 우선 + 실패 시 이 본문으로 폴백.
 *
 * 문구 스타일은 08_KAKAO_TEMPLATES.md 가이드 준수(정보성·존칭·브랜드 머리말·쉼표 금액).
 * 광고성 문구 금지(심사 통과 원칙).
 */
import type { NotifyVariables, StaticTextConfig, StoreMessageTemplate } from './types';

/** admin 수신 센티넬 — enqueue 시 to_phone 에 저장, sender 가 env 실번호로 치환. */
export const ADMIN_RECIPIENT_SENTINEL = '__admin__';

type Recipient = 'admin' | 'buyer';

interface TemplateSpec {
  recipient: Recipient;
  buildText(vars: NotifyVariables, cfg: StaticTextConfig): string;
}

// ── 택배사 라벨·조회 URL (source of truth: 0021 store_shipments.carrier CHECK) ──
//    store/lib/carriers.ts 와 동일 매핑을 lib 에 최소 복제(shipped 문자 자체완결용).
const CARRIER_LABELS: Record<string, string> = {
  cj: 'CJ대한통운',
  lotte: '롯데택배',
  hanjin: '한진택배',
  logen: '로젠택배',
  post: '우체국택배',
};
const CARRIER_TRACKING_URL: Record<string, (no: string) => string> = {
  cj: (no) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${no}`,
  lotte: (no) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${no}`,
  hanjin: (no) =>
    `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${no}`,
  logen: (no) => `https://www.ilogen.com/web/personal/trace/${no}`,
  post: (no) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${no}`,
};

function str(v: NotifyVariables, key: string): string {
  const x = v[key];
  return x === null || x === undefined ? '' : String(x);
}

/** 정수 금액 → 쉼표 표기(1430000 → "1,430,000"). */
function won(v: NotifyVariables, key: string): string {
  const n = Number(v[key]);
  if (!Number.isFinite(n)) return str(v, key);
  return n.toLocaleString('ko-KR');
}

/** ISO 문자열 → "2026-07-06 12:00" (KST). 실패 시 원문. */
function whenKst(v: NotifyVariables, key: string): string {
  const raw = str(v, key);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

const TEMPLATES: Record<StoreMessageTemplate, TemplateSpec> = {
  new_order_admin: {
    recipient: 'admin',
    buildText: (v) =>
      `[벽걸이프로] 신규주문\n` +
      `주문 ${str(v, 'order_no')}\n` +
      `${str(v, 'buyer_name')}(${str(v, 'phone_tail4')})\n` +
      `${str(v, 'items_summary')}\n` +
      `결제금액 ${won(v, 'total_amount')}원\n` +
      `관리자에서 입금확인을 진행하세요.`,
  },
  payment_confirmed: {
    recipient: 'buyer',
    buildText: (v, cfg) =>
      `${cfg.brand}\n` +
      `입금이 확인되었습니다.\n` +
      `주문 ${str(v, 'order_no')}\n` +
      `상품 준비 후 배송해 드립니다.\n` +
      `주문조회 ${cfg.lookupUrl}`,
  },
  shipped: {
    recipient: 'buyer',
    buildText: (v, cfg) => {
      const carrier = str(v, 'carrier');
      const tracking = str(v, 'tracking_no');
      const label = CARRIER_LABELS[carrier] ?? carrier;
      const url = CARRIER_TRACKING_URL[carrier]?.(tracking.replace(/\D/g, ''));
      return (
        `${cfg.brand}\n` +
        `주문 ${str(v, 'order_no')} 상품이 발송되었습니다.\n` +
        `${label} ${tracking}\n` +
        (url ? `배송조회 ${url}\n` : '') +
        `주문조회 ${cfg.lookupUrl}`
      );
    },
  },
  payment_reminder: {
    recipient: 'buyer',
    buildText: (v, cfg) =>
      `${cfg.brand}\n` +
      `주문 ${str(v, 'order_no')} 입금 기한이 곧 만료됩니다.\n` +
      `기한 ${whenKst(v, 'expires_at')}\n` +
      `결제금액 ${won(v, 'total_amount')}원\n` +
      `입금계좌 ${cfg.bankInfo}\n` +
      `주문조회 ${cfg.lookupUrl}`,
  },
};

export function isKnownTemplate(t: string): t is StoreMessageTemplate {
  return t in TEMPLATES;
}

export function templateRecipient(t: string): Recipient | null {
  return isKnownTemplate(t) ? TEMPLATES[t].recipient : null;
}

/** SMS/알림톡 폴백 본문 생성. 미지 템플릿은 null(발송 skip). */
export function buildMessageText(
  template: string,
  vars: NotifyVariables,
  cfg: StaticTextConfig,
): string | null {
  if (!isKnownTemplate(template)) return null;
  return TEMPLATES[template].buildText(vars, cfg);
}
