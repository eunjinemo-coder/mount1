-- ============================================================================
-- 0026_installation_photos.sql — 시공(installation_jobs) 완료사진 첨부 + 블로그 자산화 기반
-- Source of truth: P1.2 시공 사진 워크플로 (마스터 테스터: 스케줄→완료→사진등록→블로그자산)
--
-- 이 마이그레이션이 담는 것:
--   · installation_photos — installation_jobs 한 건에 여러 장 첨부되는 시공 사진 메타
--     (실제 바이너리는 Storage 'photos-hot' 버킷, 경로 installations/{job_id}/{uuid}.{ext})
--   · RLS — admin(super_admin/ops_admin) 관리 + auditor 읽기 (installation_jobs 와 동일 접근면)
--   · Storage 정책 — 기존 photos-hot 의 기사(technician) 경로와 충돌하지 않게 'installations/'
--     프리픽스에 대해서만 admin 업로드/수정/삭제 허용. 읽기는 0008 의 admin 전체읽기로 커버.
--
-- ── 왜 별도 테이블인가 ────────────────────────────────────────────────────────
--   기존 photos 테이블은 orders(쿠팡) 전용(order_id/technician_id/slot NOT NULL, 8슬롯 고정).
--   은진님 본사 시공(installation_jobs)은 슬롯 강제 없이 "완료 사진 여러 장 + 설명" 이면 충분하고
--   블로그 자산화(주소/타입/설치내용 + 사진)에 쓰이므로, orders 도메인을 건드리지 않는 전용 테이블로 분리.
--
-- ── Storage 경로 규약 ────────────────────────────────────────────────────────
--   photos-hot/installations/{installation_job_id}/{uuid}.{ext}
--   0008 의 기사 정책은 foldername[1] = technician_id 를 요구하므로 'installations' 프리픽스는
--   기사 정책에 걸리지 않는다(교차 오염 없음). 아래 admin 정책이 이 프리픽스만 담당.
--
-- 사전조건:
--   · 0001~0025 적용 완료 (installation_jobs · admin_users · has_admin_role/admin_role 존재)
--   · Supabase 대시보드에서 'photos-hot' 버킷이 생성돼 있어야 함 (0008 주석 참조 · SQL로 버킷생성 불가)
-- ============================================================================

-- ============================================================================
-- 1. installation_photos — 시공 사진 메타 (job:photos = 1:N)
-- ============================================================================
create table installation_photos (
  id uuid primary key default gen_random_uuid(),
  installation_job_id uuid not null
    references installation_jobs(id) on delete cascade,   -- 시공건 삭제 시 사진 메타도 함께 정리
  storage_path text not null,                              -- photos-hot 내 경로(installations/{job}/{uuid}.ext)
  caption text,                                            -- 블로그 자산화용 설명(선택)
  mime_type text,
  size_bytes bigint,
  uploaded_by_admin_id uuid references admin_users(id) on delete set null,  -- 감사용(누가 올렸나)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 자유텍스트 방어선(installation_jobs 와 동일 정책)
  constraint installation_photos_caption_len check (char_length(caption) <= 500),
  constraint installation_photos_path_len    check (char_length(storage_path) <= 400)
);

comment on table installation_photos is
  '시공(installation_jobs) 완료사진 메타. 바이너리는 Storage photos-hot/installations/{job}/{uuid}. '
  'admin/auditor 만 접근(RLS). 블로그 자산화(사진+시공메타)의 소스.';
comment on column installation_photos.storage_path is
  'photos-hot 버킷 내 오브젝트 경로. 표시용 서명 URL 은 서버에서 createSignedUrl 로 생성(버킷 비공개).';

-- 시공건별 갤러리 조회(등록순) — page.tsx 가 created_at asc 로 정렬.
create index idx_installation_photos_job on installation_photos(installation_job_id, created_at);

-- ============================================================================
-- 2. RLS — admin(super_admin/ops_admin) 관리 + auditor 읽기 (installation_jobs 와 정합)
-- ============================================================================
alter table installation_photos enable row level security;

create policy installation_photos_admin_all on installation_photos for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));

create policy installation_photos_auditor_read on installation_photos for select
  using (public.admin_role() = 'auditor');

-- ============================================================================
-- 3. updated_at 자동 갱신 트리거 (set_updated_at 은 0001 정의)
-- ============================================================================
create trigger trg_installation_photos_updated
  before update on installation_photos for each row execute function set_updated_at();

-- ============================================================================
-- 4. Storage 정책 — photos-hot 'installations/' 프리픽스 admin 관리
-- ============================================================================
--   0008 의 photo_read_self_or_admin 이 이미 admin 전체읽기(user_type='admin')를 커버하므로
--   SELECT 정책은 추가하지 않는다. INSERT/UPDATE/DELETE 만 시공 운영주체(super/ops)로 신설.
--   경로 첫 세그먼트가 정확히 'installations' 인 오브젝트로 한정 → 기사 경로와 분리.
drop policy if exists installation_photo_admin_insert on storage.objects;
create policy installation_photo_admin_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos-hot'
    and (storage.foldername(name))[1] = 'installations'
    and public.has_admin_role(array['super_admin','ops_admin'])
  );

drop policy if exists installation_photo_admin_update on storage.objects;
create policy installation_photo_admin_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos-hot'
    and (storage.foldername(name))[1] = 'installations'
    and public.has_admin_role(array['super_admin','ops_admin'])
  );

drop policy if exists installation_photo_admin_delete on storage.objects;
create policy installation_photo_admin_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos-hot'
    and (storage.foldername(name))[1] = 'installations'
    and public.has_admin_role(array['super_admin','ops_admin'])
  );
