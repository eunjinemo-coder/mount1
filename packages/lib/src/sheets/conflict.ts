/**
 * 충돌 해소 — Last-Write-Wins + 동시수정 시 시트 우선 (§2.2).
 *
 * 규약:
 *   · 양쪽 updated_at 비교, 최신이 이긴다.
 *   · |Δ| ≤ window(기본 5초) = "동시 수정" → 시트 우선(은진님의 주 작업면). conflict 기록.
 *   · 시트가 window 밖에서 최신 → 시트 승(정상 반영, ok).
 *   · 앱이 window 밖에서 최신 → 앱 승(시트 미반영, conflict_app_won 기록). 비파괴.
 *   · 앱 updated_at 미상(null) → 시트 승(신규/불명 시 시트 우선 원칙).
 */

export type ConflictWinner = 'sheet' | 'app';

export interface ConflictDecision {
  readonly winner: ConflictWinner;
  /** 동시수정(window 이내) 여부 — 시트 승이라도 conflict 로 로깅하기 위함. */
  readonly simultaneous: boolean;
}

export const DEFAULT_CONFLICT_WINDOW_SEC = 5;

/**
 * @param sheetUpdatedAt 시트 편집시각(ISO). null 이면 현재로 간주(방금 편집).
 * @param appUpdatedAt   앱 최종수정(ISO). null 이면 앱 정보 없음 → 시트 승.
 */
export function resolveConflict(
  sheetUpdatedAt: string | null,
  appUpdatedAt: string | null,
  windowSec: number = DEFAULT_CONFLICT_WINDOW_SEC,
): ConflictDecision {
  if (appUpdatedAt === null) {
    return { winner: 'sheet', simultaneous: false };
  }
  const sheetMs = sheetUpdatedAt === null ? Date.now() : Date.parse(sheetUpdatedAt);
  const appMs = Date.parse(appUpdatedAt);

  // 파싱 불가 시각 → 안전하게 시트 우선
  if (Number.isNaN(sheetMs) || Number.isNaN(appMs)) {
    return { winner: 'sheet', simultaneous: false };
  }

  const deltaSec = (sheetMs - appMs) / 1000;
  if (Math.abs(deltaSec) <= windowSec) {
    // 동시 수정 → 시트 우선 + conflict
    return { winner: 'sheet', simultaneous: true };
  }
  if (deltaSec > 0) {
    // 시트가 확실히 최신 → 시트 승(정상)
    return { winner: 'sheet', simultaneous: false };
  }
  // 앱이 확실히 최신 → 앱 승(시트 미반영)
  return { winner: 'app', simultaneous: false };
}
