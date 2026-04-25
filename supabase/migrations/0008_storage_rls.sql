-- ============================================================================
-- 0008_storage_rls.sql — Supabase Storage 버킷 RLS 정책
-- Source: 04_PERMISSIONS.md §7.2 + 3차 보안 검증 P1-R5-1
-- 대상 버킷: photos-hot · signatures · cls-reports-draft
--
-- ⚠️ 사전 조건: 은진님이 Supabase Dashboard 에서 위 3 버킷을 생성해야 함.
-- 본 마이그레이션은 RLS 정책만 정의 — 버킷 자체 생성은 SQL 미지원 (대시보드 또는
-- supabase CLI `supabase storage create` 사용). _HANDOFF #6 참조.
-- ============================================================================

-- ============================================================================
-- photos-hot 버킷 — 기사 업로드 / 관리자 읽기
-- 경로 규약: photos-hot/{technician_id}/{order_id}/{slot}.{ext}
-- ============================================================================

drop policy if exists photo_upload_tech on storage.objects;
create policy photo_upload_tech on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos-hot'
    and (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'technician'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
  );

drop policy if exists photo_update_tech on storage.objects;
create policy photo_update_tech on storage.objects for update
  to authenticated
  using (
    bucket_id = 'photos-hot'
    and (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'technician'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
  );

drop policy if exists photo_delete_tech on storage.objects;
create policy photo_delete_tech on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos-hot'
    and (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'technician'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
  );

drop policy if exists photo_read_self_or_admin on storage.objects;
create policy photo_read_self_or_admin on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos-hot'
    and (
      -- admin (auditor 포함) 전체 읽기
      (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'admin'
      -- 기사는 자기 폴더만 read
      or (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
    )
  );

-- ============================================================================
-- signatures 버킷 — 기사 업로드 / 관리자 읽기 (취소 리포트 서명용)
-- 경로 규약: signatures/{technician_id}/{order_id}/sig.png
-- ============================================================================

drop policy if exists signature_upload_tech on storage.objects;
create policy signature_upload_tech on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'signatures'
    and (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'technician'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
  );

drop policy if exists signature_read_admin_or_self on storage.objects;
create policy signature_read_admin_or_self on storage.objects for select
  to authenticated
  using (
    bucket_id = 'signatures'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'admin'
      or (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'technician_id')
    )
  );

-- ============================================================================
-- cls-reports-draft 버킷 — super_admin only (CLS 전달 리포트 초안)
-- ============================================================================

drop policy if exists cls_super_only on storage.objects;
create policy cls_super_only on storage.objects for all
  to authenticated
  using (
    bucket_id = 'cls-reports-draft'
    and public.admin_role() = 'super_admin'
  )
  with check (
    bucket_id = 'cls-reports-draft'
    and public.admin_role() = 'super_admin'
  );
