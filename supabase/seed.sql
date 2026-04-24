-- 마운트파트너스 개발용 최소 시드
-- 실제 내용은 migrations 적용 후에 채워 넣는다.
-- 참조: 05_TECH_STACK/03_BACKEND_SUPABASE.md, 06_ROADMAP/05_SCAFFOLDING.md §3.5

-- TODO(Phase 0 Step 4):
--   · app_settings: gini_config · dispatch_weights · dispatch_limits · 근무관리_입력주체
--   · territories: 시/도 17개 + 시군구 참조 데이터
--   · 카카오 알림톡 템플릿 ID 9종 (T01~T09)
--   · 대표 계정 1건 (super_admin, locked_until=NULL, IP 화이트리스트 비어있음)

-- 현재 스캐폴딩 단계에선 placeholder. 다음 세션에서 실제 시드 작성.
select 1 as seed_placeholder;
