/**
 * installation(installation_jobs) ↔ 시트 매핑 순수 로직 (server-only 아님 → 단위 테스트 대상).
 * entity-adapter.ts 가 이 함수들을 supabase 클라이언트와 조립한다.
 *
 * 대상 테이블: installation_jobs (은진님 본사 시공건 · 시트 A~M 1:1 · 0025). orders(쿠팡) 아님.
 *
 * ── 시트 열(A~M) ↔ 앱 필드키 ↔ DB 컬럼 ─────────────────────────────────────────
 *   A 시공일자  scheduled_install_date  → scheduled_install_date (date)
 *   B 접수일자  received_date           → received_date          (date)
 *   C 이사일자  move_date               → move_date              (date)
 *   D 방문시간  visit_time              → visit_time             (text · 자유서식)
 *   E 담당자    technician_name         → technician_name        (text)
 *   F 연락처    customer_contact        → customer_phone         (text)
 *   G 연락처2   customer_contact2       → customer_phone2        (text)
 *   H 주소      address                 → address                (text)
 *   I 상세주소  address_detail          → address_detail         (text)
 *   J 성함      customer_name           → customer_name          (text)
 *   K 타입      install_type            → install_type           (text)
 *   L 설치내용  install_content         → install_content        (text)
 *   M 특이사항  special_notes           → special_notes          (text)
 *
 *   ⚠ F/G 는 필드키를 일부러 customer_contact/customer_contact2 로 둔다(= DB 컬럼명과 다름).
 *     순수 엔진의 형식검증(column-map.ruleFor)은 필드키에 'phone'/'tel' 이 있으면 전화 규칙
 *     (9~11자리)을 강제한다. 은진님 연락처 칸은 "010-1234-5678 (남편)" 같은 자유서식이 흔한데,
 *     전화 규칙에 걸리면 그 행 전체가 반려(⚠)되어 1차 워크플로(시트 선기록)를 막는다. 따라서
 *     'phone' 을 피한 키로 자유서식(원문 보존)으로 취급한다. status 는 시트 미동기화(앱 내부).
 */
import type { ColumnMap, MappedRow } from '@mount/lib/sheets';

/** 시트 동기화 대상 필드키 13종(status 제외 — 앱 내부). column_map 의 값이 이 키여야 한다. */
export const INSTALLATION_FIELD_KEYS = [
  'scheduled_install_date',
  'received_date',
  'move_date',
  'visit_time',
  'technician_name',
  'customer_contact',
  'customer_contact2',
  'address',
  'address_detail',
  'customer_name',
  'install_type',
  'install_content',
  'special_notes',
] as const;

export type InstallationFieldKey = (typeof INSTALLATION_FIELD_KEYS)[number];

/** 앱 필드키 → installation_jobs DB 컬럼. (대부분 동일 · 연락처만 상이) */
export const FIELD_TO_COLUMN: Readonly<Record<InstallationFieldKey, string>> = {
  scheduled_install_date: 'scheduled_install_date',
  received_date: 'received_date',
  move_date: 'move_date',
  visit_time: 'visit_time',
  technician_name: 'technician_name',
  customer_contact: 'customer_phone',
  customer_contact2: 'customer_phone2',
  address: 'address',
  address_detail: 'address_detail',
  customer_name: 'customer_name',
  install_type: 'install_type',
  install_content: 'install_content',
  special_notes: 'special_notes',
};

/** date 규칙(YYYY-MM-DD)으로 다루는 필드키. */
const DATE_FIELDS: ReadonlySet<InstallationFieldKey> = new Set([
  'scheduled_install_date',
  'received_date',
  'move_date',
]);

/**
 * 은진님 양식 A~M 기본 열매핑(설정 UI 프리셋). 은진님은 이 매핑을 확인만 하면 된다.
 * N/O 는 비움/스페이서, _sync_id 숨김열은 P(아래) 권장 → A~M 데이터와 충돌하지 않음.
 */
export const DEFAULT_INSTALLATION_COLUMN_MAP: ColumnMap = {
  A: 'scheduled_install_date',
  B: 'received_date',
  C: 'move_date',
  D: 'visit_time',
  E: 'technician_name',
  F: 'customer_contact',
  G: 'customer_contact2',
  H: 'address',
  I: 'address_detail',
  J: 'customer_name',
  K: 'install_type',
  L: 'install_content',
  M: 'special_notes',
};

/** _sync_id 숨김열 권장 위치(A~M 데이터열과 O 스페이서를 피함). */
export const DEFAULT_INSTALLATION_SYNC_ID_COLUMN = 'P';

/** installation_jobs 조회행(매핑 대상 컬럼만). */
export interface InstallationJobRow {
  id: string;
  scheduled_install_date: string | null;
  received_date: string | null;
  move_date: string | null;
  visit_time: string | null;
  technician_name: string | null;
  customer_phone: string | null;
  customer_phone2: string | null;
  address: string | null;
  address_detail: string | null;
  customer_name: string | null;
  install_type: string | null;
  install_content: string | null;
  special_notes: string | null;
  updated_at: string | null;
}

/** YYYY-MM-DD 형식 + 실재 날짜 검증. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === value;
}

/** installation_jobs 행 → 시트 매핑필드(읽기 투영). status 는 포함하지 않음(시트 미동기화). */
export function toFields(row: InstallationJobRow): MappedRow {
  const fields: Record<string, string> = {};
  const put = (key: InstallationFieldKey, v: string | null | undefined): void => {
    if (v !== null && v !== undefined && String(v).length > 0) fields[key] = String(v);
  };
  put('scheduled_install_date', normalizeDbDate(row.scheduled_install_date));
  put('received_date', normalizeDbDate(row.received_date));
  put('move_date', normalizeDbDate(row.move_date));
  put('visit_time', row.visit_time);
  put('technician_name', row.technician_name);
  put('customer_contact', row.customer_phone);
  put('customer_contact2', row.customer_phone2);
  put('address', row.address);
  put('address_detail', row.address_detail);
  put('customer_name', row.customer_name);
  put('install_type', row.install_type);
  put('install_content', row.install_content);
  put('special_notes', row.special_notes);
  return fields;
}

/**
 * DB date 값을 시트 정본(YYYY-MM-DD)으로 정규화. postgres date 는 보통 'YYYY-MM-DD' 지만
 * 드라이버/뷰가 timestamptz 로 넘길 가능성(…T00:00:00Z)에 대비해 앞 10자를 취해 왕복 정합 보장.
 */
function normalizeDbDate(value: string | null): string | null {
  if (!value) return null;
  const head = value.slice(0, 10);
  return isValidIsoDate(head) ? head : null;
}

/** 시트발 매핑필드에서 최소 생성요건 충족 여부(신규 시트행 → 생성 가드). */
export function hasMinimalForCreate(fields: MappedRow): boolean {
  const hasDate =
    typeof fields.scheduled_install_date === 'string' &&
    isValidIsoDate(fields.scheduled_install_date);
  const hasName =
    typeof fields.customer_name === 'string' && fields.customer_name.trim().length > 0;
  return hasDate || hasName;
}

/**
 * 매핑필드 → installation_jobs 쓰기 객체. status(앱 내부)·id·미지원 키는 제외.
 * date 필드는 형식검증 통과분만(오염 차단). 빈 문자열은 그대로 반영(칸 비우기 허용).
 */
export function buildInstallationWrite(fields: MappedRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of INSTALLATION_FIELD_KEYS) {
    const value = fields[key];
    if (value === undefined) continue;
    if (DATE_FIELDS.has(key)) {
      // 날짜는 유효한 YYYY-MM-DD 만(빈 문자열/오형식은 skip → date 컬럼 오염/에러 차단)
      if (value.length > 0 && isValidIsoDate(value)) out[FIELD_TO_COLUMN[key]] = value;
      continue;
    }
    out[FIELD_TO_COLUMN[key]] = value;
  }
  return out;
}
