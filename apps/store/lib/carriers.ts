/**
 * 택배사 코드 → 라벨·배송조회 URL 매핑 (S5 주문조회 운송장 추적 링크).
 *
 * carrier 코드는 0021_store.sql store_shipments.carrier CHECK 와 일치:
 *   'cj' | 'lotte' | 'hanjin' | 'logen' | 'post'
 */
export type CarrierCode = 'cj' | 'lotte' | 'hanjin' | 'logen' | 'post';

interface Carrier {
  label: string;
  /** 운송장번호를 받아 조회 URL 을 반환. 번호는 숫자만 남겨 인코딩. */
  trackingUrl: (trackingNo: string) => string;
}

const CARRIERS: Record<CarrierCode, Carrier> = {
  cj: {
    label: 'CJ대한통운',
    trackingUrl: (no) =>
      `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(digits(no))}`,
  },
  lotte: {
    label: '롯데택배',
    trackingUrl: (no) =>
      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encodeURIComponent(digits(no))}`,
  },
  hanjin: {
    label: '한진택배',
    trackingUrl: (no) =>
      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(digits(no))}`,
  },
  logen: {
    label: '로젠택배',
    trackingUrl: (no) =>
      `https://www.ilogen.com/web/personal/trace/${encodeURIComponent(digits(no))}`,
  },
  post: {
    label: '우체국택배',
    trackingUrl: (no) =>
      `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(digits(no))}`,
  },
};

function digits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isCarrierCode(value: string): value is CarrierCode {
  return value in CARRIERS;
}

export function carrierLabel(code: string): string {
  return isCarrierCode(code) ? CARRIERS[code].label : code;
}

/** 알 수 없는 코드거나 운송장번호가 비면 null. */
export function carrierTrackingUrl(code: string, trackingNo: string): string | null {
  if (!isCarrierCode(code) || !trackingNo || digits(trackingNo).length === 0) return null;
  return CARRIERS[code].trackingUrl(trackingNo);
}
