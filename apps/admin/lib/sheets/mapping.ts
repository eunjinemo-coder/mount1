/**
 * installation(orders) ↔ 시트 매핑 순수 로직 (server-only 아님 → 단위 테스트 대상).
 * entity-adapter.ts 가 이 함수들을 supabase 클라이언트와 조립한다.
 */
import type { MappedRow } from '@mount/lib/sheets';

/** orders.status 18종 — 시트발 status 는 이 집합에 있을 때만 반영(오염 차단). */
export const ALLOWED_ORDER_STATUSES: ReadonlySet<string> = new Set([
  'received',
  'happy_call_pending',
  'happy_call_done',
  'scheduled',
  'assigned',
  'en_route',
  'on_site',
  'in_progress',
  'no_drill_completed',
  'drill_converted_completed',
  'awaiting_payment',
  'payment_sent',
  'paid',
  'postponed',
  'on_hold',
  'cancel_requested',
  'cancel_confirmed_coupang_transfer',
  'closed',
]);

export interface OrderJoinRow {
  id: string;
  status: string | null;
  scheduled_installation_at: string | null;
  tv_brand: string | null;
  tv_model: string | null;
  tv_size_inch: number | null;
  special_notes: string | null;
  updated_at: string | null;
  customers: {
    phone_tail4: string | null;
    address_region_sido: string | null;
    address_region_sigungu: string | null;
  } | null;
  technicians: { display_name: string | null } | null;
}

/**
 * timestamptz(ISO) → KST 날짜 YYYY-MM-DD. ISO 로 두어야 parseSheetRow/scheduledDateToTimestamp
 * 와 왕복 정합(에코루프 성립). formatDateKST 는 ko-KR 로캘("2026. 07. 10.")이라 왕복 불가 → 미사용.
 */
export function toKstDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** orders 조인행 → 시트 매핑필드(읽기 투영). */
export function toFields(row: OrderJoinRow): MappedRow {
  const fields: Record<string, string> = {};
  const put = (k: string, v: string | null | undefined): void => {
    if (v !== null && v !== undefined && String(v).length > 0) fields[k] = String(v);
  };
  put('status', row.status);
  if (row.scheduled_installation_at) {
    put('scheduled_date', toKstDate(row.scheduled_installation_at) ?? ''); // YYYY-MM-DD (KST, ISO)
  }
  put('tv_brand', row.tv_brand);
  put('tv_model', row.tv_model);
  put('tv_size', row.tv_size_inch !== null ? String(row.tv_size_inch) : null);
  put('special_notes', row.special_notes);
  put('phone_tail4', row.customers?.phone_tail4);
  put('region_sido', row.customers?.address_region_sido);
  put('region_sigungu', row.customers?.address_region_sigungu);
  put('technician_name', row.technicians?.display_name);
  return fields;
}

/** scheduled_date(YYYY-MM-DD) → KST 자정 timestamptz(ISO). 잘못된 값 → null. */
export function scheduledDateToTimestamp(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * 시트발 매핑필드 → orders 쓰기 패치. 쓰기 허용 필드(status/scheduled_date/special_notes)만.
 * status 는 enum 검증 통과분만(오염 차단). 반영할 게 없으면 빈 객체.
 */
export function buildOrderPatch(fields: MappedRow): Record<string, string> {
  const patch: Record<string, string> = {};
  if (fields.status && ALLOWED_ORDER_STATUSES.has(fields.status)) {
    patch.status = fields.status;
  }
  if (fields.scheduled_date) {
    const ts = scheduledDateToTimestamp(fields.scheduled_date);
    if (ts) patch.scheduled_installation_at = ts;
  }
  if (fields.special_notes !== undefined) {
    patch.special_notes = fields.special_notes;
  }
  return patch;
}
