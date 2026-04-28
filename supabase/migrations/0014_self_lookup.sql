-- ============================================================================
-- 0014_self_lookup.sql — 본인 row self-select 정책 보강 (멱등)
-- Source: getSession() 의 DB fallback (Hook OFF / 미설정 시 본인 row 조회)
--
-- 기존 technicians_select_self 정책은 `id = public.technician_id()` 기반인데,
-- Hook 이 JWT 에 technician_id 를 안 채우면 함수가 null 반환 → 본인 row 도 못 봄.
-- auth_user_id 기반 self-select 를 추가하여 fallback 경로 보장.
--
-- admin_users 는 0002 의 admin_users_select_self 가 이미 auth_user_id 기반이라 OK.
-- ============================================================================

drop policy if exists technicians_select_auth_self on technicians;
create policy technicians_select_auth_self on technicians for select
  using (auth_user_id = auth.uid());
