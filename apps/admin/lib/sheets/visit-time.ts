/**
 * 방문시간(D) 파싱 + 정렬 위치 계산 (순수 · 단위 테스트 대상).
 *
 * 은진님 시트는 하나의 깔끔한 표이고 시공일자(A) 오름차순 + 방문시간(D) 오름차순으로 정렬돼
 * 있다. 앱→시트로 신규 시공건을 쓸 때 맨 아래 append 대신 이 정렬 위치에 삽입한다(은진님 요구).
 * 실 삽입(insertDimension)은 sheets-client 가, 삽입 오프셋 계산은 여기(순수)가 담당.
 *
 * ── 방문시간 표기 규칙(은진님 확정) ─────────────────────────────────────────────
 *   "N시" 또는 "N시반"(반 = +30분). 영업 09:00~20:00.
 *     N ∈ {9,10,11,12} → hour = N            (오전~정오)
 *     N ∈ {1,2,3,4,5,6,7,8} → hour = N + 12   (오후)
 *     반 → minute = 30, 아니면 0
 *     sortKey(분) = hour*60 + minute
 *   예: 9시=540(최소) · 12시=720 < 12시반=750 < 1시=780 < 1시반=810 < 2시=840 · 8시반=1230(최대)
 *   예상외 표기 → null(파싱 실패). 호출측은 그 날짜 그룹의 끝에 삽입 + 로그(등록 자체는 성공).
 */
import { parseSheetDateToIso } from './mapping';

/** 파싱 실패 방문시간 → 해당 날짜 그룹의 끝으로(가장 큰 값). */
export const VISIT_TIME_FALLBACK = 100000;
/** 파싱 실패 날짜 → 데이터 끝으로(가장 큰 값). */
const DATE_FALLBACK = '9999-99-99';

const VISIT_RE = /^(\d{1,2})\s*시\s*(반)?$/;

/** "N시"/"N시반" → 하루 분(minutes). 예상외 표기/영업외 시간 → null. */
export function parseVisitTimeMinutes(raw: string): number | null {
  const m = VISIT_RE.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  let hour: number;
  if (n >= 9 && n <= 12) hour = n;
  else if (n >= 1 && n <= 8) hour = n + 12;
  else return null; // 0시 · 13시+ 등 영업 표기 밖
  const minute = m[2] === '반' ? 30 : 0;
  return hour * 60 + minute;
}

/**
 * 시트 A열 날짜 원문 → ISO(YYYY-MM-DD). 매핑 모듈의 parseSheetDateToIso 에 위임(단일 소스).
 * "2026-07-30" · "2026.7.30" · "2025. 3. 1"(점 뒤 공백) 등 허용, 4자리 연도 없으면 null.
 */
export function normalizeSheetDate(raw: string): string | null {
  return parseSheetDateToIso(raw);
}

export interface SortRow {
  /** A열(시공일자) 원문. */
  date: string;
  /** D열(방문시간) 원문. */
  visit: string;
}

interface SortKey {
  date: string;
  time: number;
}

function keyFor(row: SortRow): SortKey {
  return {
    date: normalizeSheetDate(row.date) ?? DATE_FALLBACK,
    time: parseVisitTimeMinutes(row.visit) ?? VISIT_TIME_FALLBACK,
  };
}

/** 1차 날짜 오름차순, 2차 방문시간 오름차순. */
function compareKey(a: SortKey, b: SortKey): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.time - b.time;
}

/**
 * 정렬된 데이터행들 사이에서 신규행이 들어갈 오프셋(0-base, 데이터영역 기준)을 계산.
 * = 신규행보다 정렬상 "뒤(늦은)"인 첫 행 앞. 없으면 데이터 끝(existing.length).
 * 신규행 날짜 파싱 실패 → null(호출측 append 폴백).
 *
 * 안정성(동률): compareKey 가 0(같은 날짜·같은 시간)인 기존 행은 "뒤"가 아니므로 건너뛴다
 * → 동일 키 그룹의 맨 끝에 삽입(기존 행 순서 보존).
 */
export function computeInsertOffset(existing: readonly SortRow[], newRow: SortRow): number | null {
  const newDate = normalizeSheetDate(newRow.date);
  if (newDate === null) return null;
  const newKey: SortKey = {
    date: newDate,
    time: parseVisitTimeMinutes(newRow.visit) ?? VISIT_TIME_FALLBACK,
  };
  for (let i = 0; i < existing.length; i += 1) {
    if (compareKey(keyFor(existing[i]!), newKey) > 0) return i;
  }
  return existing.length;
}
