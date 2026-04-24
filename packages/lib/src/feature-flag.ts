// Feature flag 추상화.
// MVP: 하드코딩 기본값. Phase 1 후반: Supabase feature_flags 테이블 + 실시간 구독.
// 참조: 05_TECH_STACK/06_EXTENSIBILITY_ARCHITECTURE.md §3 Feature Flag

export type FeatureFlagKey =
  | 'coupang_csv_auto_import'
  | 'dispatch_preview_v2'
  | 'live_map'
  | 'photo_tier_migration'
  | (string & Record<never, never>);

const defaults: Record<string, boolean> = {
  coupang_csv_auto_import: false,
  dispatch_preview_v2: false,
  live_map: false,
  photo_tier_migration: false,
};

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return defaults[key] ?? false;
}
