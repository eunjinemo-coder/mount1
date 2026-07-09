/**
 * 열 매핑 — 시트 열(A/B/…) ↔ 앱 필드명 변환 + 경계 검증 (§2.3 · §2.4).
 *
 * 은진님의 시트 양식을 바꾸지 않는다 → column_map 이 은진님 열배치를 앱 필드로 옮긴다.
 *   · buildSheetRow: 앱 매핑필드 → 시트 열문자 키 객체 (앱→시트 전송용)
 *   · parseSheetRow: 시트 행 값 배열 → 앱 매핑필드 + 형식검증 경고 (시트→앱 수신용)
 *
 * 검증(§2.4 "깨진 데이터"): 날짜·전화 형식 오류는 앱에 반영하지 않고 경고로 반환 →
 * 호출측(웹훅)이 시트 상태열에 ⚠ 표기 + sync_log(error). 앱 데이터는 오염되지 않는다.
 */
import type { ColumnMap, MappedRow } from './types';

// A→0, B→1, …, Z→25, AA→26 … (스프레드시트 열문자 인덱스)
export function columnLetterToIndex(letter: string): number {
  let idx = 0;
  const up = letter.trim().toUpperCase();
  for (const ch of up) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return -1; // A-Z 아님 → 무효
    idx = idx * 26 + (code - 64);
  }
  return idx - 1;
}

/** 필드명 → 시트 열문자 역매핑. */
function invertColumnMap(map: ColumnMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [col, field] of Object.entries(map)) out[field] = col;
  return out;
}

/**
 * 앱 매핑필드 → 시트 열문자 키 객체. (앱→시트 upsert 시 셀 위치 지정)
 * 예: fields={scheduled_date:'2026-07-10'}, map={"B":"scheduled_date"} → {"B":"2026-07-10"}
 */
export function buildSheetRow(fields: MappedRow, map: ColumnMap): Record<string, string> {
  const inv = invertColumnMap(map);
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    const col = inv[field];
    if (!col) continue; // 매핑 안 된 필드는 시트에 쓰지 않음
    out[col] = value ?? '';
  }
  return out;
}

export interface ParseWarning {
  readonly field: string;
  readonly value: string;
  readonly rule: 'date' | 'phone';
}

export interface ParseResult {
  /** 검증 통과 매핑필드(경고난 필드는 제외 — 앱 미오염). */
  readonly fields: MappedRow;
  readonly warnings: readonly ParseWarning[];
}

// YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD 허용 → ISO(YYYY-MM-DD) 로 표준화.
const DATE_RE = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/;
// 국내 전화(숫자/하이픈/공백) — 정규화 후 9~11자리 숫자.
const PHONE_ALLOWED_RE = /^[0-9\-\s()]+$/;

function normalizeDate(value: string): string | null {
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // 실재 날짜 검증(2월 30일 등 차단)
  const dt = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.getUTCDate() !== day) return null;
  return iso;
}

function normalizePhone(value: string): string | null {
  const t = value.trim();
  if (!PHONE_ALLOWED_RE.test(t)) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) return null;
  return digits;
}

/**
 * 필드명 접미사로 검증규칙 판정(관용): *_date→날짜, phone*→전화.
 * phone_tail4(4자리 뒷번호)는 전화 규칙에서 제외 — 9~11자리 검증에 걸려 허위 형식오류가 나면
 * 그 행의 모든 편집이 반려되므로(읽기전용 투영인데도), 'tail' 포함 필드는 일반 문자열로 취급.
 */
function ruleFor(field: string): 'date' | 'phone' | null {
  const f = field.toLowerCase();
  if (f.endsWith('_date') || f.endsWith('_at') || f === 'date') return 'date';
  if ((f.includes('phone') || f.includes('tel')) && !f.includes('tail')) return 'phone';
  return null;
}

/**
 * 시트 행 값 배열 → 앱 매핑필드 + 형식경고.
 * @param values 시트 한 행의 셀 값 배열(열 인덱스 순). 누락 열은 undefined/빈칸.
 */
export function parseSheetRow(values: readonly string[], map: ColumnMap): ParseResult {
  const fields: Record<string, string> = {};
  const warnings: ParseWarning[] = [];

  for (const [col, field] of Object.entries(map)) {
    const idx = columnLetterToIndex(col);
    if (idx < 0) continue; // 무효 열문자 무시
    const raw = idx < values.length ? (values[idx] ?? '') : '';
    const value = String(raw).trim();
    if (value.length === 0) continue; // 빈칸 = 미제공(누락 열 관대 처리)

    const rule = ruleFor(field);
    if (rule === 'date') {
      const norm = normalizeDate(value);
      if (norm === null) {
        warnings.push({ field, value, rule });
        continue; // 앱 미오염
      }
      fields[field] = norm;
    } else if (rule === 'phone') {
      const norm = normalizePhone(value);
      if (norm === null) {
        warnings.push({ field, value, rule });
        continue;
      }
      fields[field] = norm;
    } else {
      fields[field] = value;
    }
  }

  return { fields, warnings };
}

/**
 * 앱→시트 전송값이 웹훅에서 되파싱될 때의 정본 필드 (C1: 에코루프 해시용).
 *
 * 문제: outbox 가 어댑터 전체필드(10개)를 해시하고 웹훅은 매핑필드만 해시하면 두 해시가
 * 구조적으로 안 맞아 에코 no-op 이 항상 실패 → 정상흐름마다 허위 conflict + updated_at churn.
 * 해결: outbox 도 웹훅과 "동일 필드셋·동일 정본화"로 해시하도록, buildSheetRow(매핑 열만)로
 * 시트에 실제 쓰일 값을 만든 뒤 parseSheetRow 로 되파싱해 웹훅이 볼 필드를 그대로 재현한다.
 * (시트 쓰기는 RAW 라 우리가 쓴 문자열이 그대로 보관 → 왕복이 결정적으로 일치)
 */
export function mappedFieldsForHash(fields: MappedRow, map: ColumnMap): MappedRow {
  const cells = buildSheetRow(fields, map); // {열문자: 값} — 매핑된 필드만
  let maxIdx = -1;
  for (const col of Object.keys(cells)) maxIdx = Math.max(maxIdx, columnLetterToIndex(col));
  const values: string[] = new Array(maxIdx + 1).fill('');
  for (const [col, v] of Object.entries(cells)) {
    const idx = columnLetterToIndex(col);
    if (idx >= 0) values[idx] = v;
  }
  return parseSheetRow(values, map).fields;
}
