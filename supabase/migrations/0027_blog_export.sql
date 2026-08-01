-- ============================================================================
-- 0027_blog_export.sql — 시공 → 블로그 자산화 내보내기 추적
--
-- 목적(성장 마스터플랜): B엔진(자사 시공 운영)의 부산물(사진+시공메타)을 C엔진(블로그
-- 콘텐츠)의 원료로 흘려보낸다. 어떤 시공건이 이미 블로그로 나갔는지 추적해 중복 생성을 막는다.
--
-- 구조: installation_jobs 에 내보낸 시각만 기록(별도 테이블 불필요).
--   · null      = 아직 안 나감(완료 + 사진 있으면 "블로그 대기")
--   · not null  = 이미 블로그 잡으로 전달됨
--
-- PII: 실제 내보내기 페이로드는 앱 서버(lib/blog/payload.ts)가 지역만 남기고 성함·연락처·
--   상세주소·단지명을 제거한다. 이 마이그레이션은 상태만 담는다.
--
-- 사전조건: 0025(installation_jobs) · 0026(installation_photos) 적용 완료.
-- ============================================================================

alter table installation_jobs
  add column if not exists blog_exported_at timestamptz;

comment on column installation_jobs.blog_exported_at is
  '블로그 초안 생성용으로 내보낸 시각. null=미전달(완료+사진 있으면 대기). 중복 전달 방지 기준.';

-- "블로그 대기" 조회: 완료 상태 + 미전달 건만 (부분 인덱스로 슬림하게)
create index if not exists idx_installation_jobs_blog_pending
  on installation_jobs(scheduled_install_date desc)
  where status = 'completed' and blog_exported_at is null;
