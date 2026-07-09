/**
 * content_hash — 매핑필드 스냅샷의 안정적 지문 (§2.2 에코루프/멱등의 기반).
 *
 * 규약:
 *   · 키를 정렬한 정본 JSON 을 sha256 → hex. 키 순서·객체 삽입순서에 불변.
 *   · 값은 문자열로 정규화(앞뒤 공백 trim). 시트 셀 = 문자열이므로 양방향이 같은 규칙을
 *     쓰면 "앱이 쓴 값"과 "시트에서 되돌아온 값"이 동일 해시가 되어 에코가 no-op 된다.
 *   · undefined/null 값 필드는 제외(빈칸과 미존재를 동일 취급 — 시트 빈셀 호환).
 *
 * 주의: 양쪽(앱→시트 enqueue, 시트→앱 웹훅)이 반드시 같은 필드집합·같은 정규화로
 *       해시해야 에코루프가 성립한다. buildSheetRow/parseSheetRow 와 짝을 이룬다.
 */
import { createHash } from 'node:crypto';
import type { MappedRow } from './types';

/** 값 정규화 — trim. (숫자/날짜 표준화는 column-map 파서가 담당) */
export function normalizeValue(v: string): string {
  return v.trim();
}

/** 매핑필드를 정본 형태(정렬·정규화·빈값제거)로 환원. 해시/비교의 단일 기준. */
export function canonicalize(row: MappedRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(row).sort()) {
    const raw = row[key];
    if (raw === undefined || raw === null) continue;
    const norm = normalizeValue(String(raw));
    if (norm.length === 0) continue; // 빈칸 = 미존재
    out[key] = norm;
  }
  return out;
}

/** 매핑필드 스냅샷의 content_hash (sha256 hex). */
export function contentHash(row: MappedRow): string {
  const canonical = canonicalize(row);
  const json = JSON.stringify(canonical);
  return createHash('sha256').update(json, 'utf8').digest('hex');
}

/** 두 매핑필드가 동일 내용인지(정규화 후). */
export function sameContent(a: MappedRow, b: MappedRow): boolean {
  return contentHash(a) === contentHash(b);
}
