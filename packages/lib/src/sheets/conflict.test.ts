import { describe, expect, it } from 'vitest';
import { resolveConflict } from './conflict';

describe('resolveConflict — LWW + 동시수정 시 시트 우선(§2.2)', () => {
  it('앱 시각 미상(null) → 시트 승', () => {
    expect(resolveConflict('2026-07-10T10:00:00Z', null).winner).toBe('sheet');
  });

  it('시트가 확실히(>window) 최신 → 시트 승, 비동시', () => {
    const d = resolveConflict('2026-07-10T10:00:20Z', '2026-07-10T10:00:00Z', 5);
    expect(d.winner).toBe('sheet');
    expect(d.simultaneous).toBe(false);
  });

  it('앱이 확실히(>window) 최신 → 앱 승(시트 미반영)', () => {
    const d = resolveConflict('2026-07-10T10:00:00Z', '2026-07-10T10:00:20Z', 5);
    expect(d.winner).toBe('app');
    expect(d.simultaneous).toBe(false);
  });

  it('동시 수정(±window 이내) → 시트 우선 + simultaneous', () => {
    const d = resolveConflict('2026-07-10T10:00:03Z', '2026-07-10T10:00:00Z', 5);
    expect(d.winner).toBe('sheet');
    expect(d.simultaneous).toBe(true);
  });

  it('경계값(정확히 window) → 동시로 간주(시트 우선)', () => {
    const d = resolveConflict('2026-07-10T10:00:05Z', '2026-07-10T10:00:00Z', 5);
    expect(d.winner).toBe('sheet');
    expect(d.simultaneous).toBe(true);
  });

  it('파싱 불가 시각 → 안전하게 시트 우선', () => {
    expect(resolveConflict('not-a-date', '2026-07-10T10:00:00Z').winner).toBe('sheet');
  });
});
