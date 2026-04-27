-- ============================================================================
-- 0013_hook_grant_recovery.sql — Custom Access Token Hook 권한 복구 (멱등)
-- Source: dev 로그인 500 "Database error querying schema" 진단
--   (Supabase auth API 호출 시 Hook 내부에서 admin_users/technicians 조회 실패)
--
-- 0004_hooks.sql 의 grant + RLS bypass 정책이 후속 마이그레이션 또는 dashboard
-- 작업 중 손실된 것으로 추정 — 본 파일이 멱등 재선언으로 복구.
-- ============================================================================

-- ============================================================================
-- 1) Hook 함수 재배포 (CREATE OR REPLACE — 본문은 0004 와 동일하나 명시 재선언)
--    OR REPLACE 가 grant 를 reset 하지 않음 (PostgreSQL 보장).
--    여기서는 search_path + security definer 를 다시 명시.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_admin record;
  v_tech_id uuid;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  v_user_id := (event->>'user_id')::uuid;

  if claims->'app_metadata' is null or jsonb_typeof(claims->'app_metadata') <> 'object' then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  begin
    select id, role
      into v_admin
      from public.admin_users
     where auth_user_id = v_user_id
       and status = 'active'
     limit 1;
  exception when others then
    -- admin_users 조회 실패 시 hook 자체 fail 회피 — fallback 으로 빈 metadata
    raise warning 'hook admin_users lookup failed: %', sqlerrm;
    v_admin := null;
  end;

  if v_admin.id is not null then
    claims := jsonb_set(claims, '{app_metadata,user_type}',     to_jsonb('admin'::text));
    claims := jsonb_set(claims, '{app_metadata,admin_role}',    to_jsonb(v_admin.role));
    claims := jsonb_set(claims, '{app_metadata,admin_user_id}', to_jsonb(v_admin.id));
    claims := jsonb_set(claims, '{app_metadata,technician_id}', 'null'::jsonb);
  else
    begin
      select id into v_tech_id
        from public.technicians
       where auth_user_id = v_user_id
         and status = 'active'
       limit 1;
    exception when others then
      raise warning 'hook technicians lookup failed: %', sqlerrm;
      v_tech_id := null;
    end;

    if v_tech_id is not null then
      claims := jsonb_set(claims, '{app_metadata,user_type}',     to_jsonb('technician'::text));
      claims := jsonb_set(claims, '{app_metadata,technician_id}', to_jsonb(v_tech_id));
      claims := jsonb_set(claims, '{app_metadata,admin_role}',    'null'::jsonb);
      claims := jsonb_set(claims, '{app_metadata,admin_user_id}', 'null'::jsonb);
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- ============================================================================
-- 2) supabase_auth_admin 권한 복구 (멱등) — 가장 의심스러운 root cause
-- ============================================================================

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

grant select on public.admin_users to supabase_auth_admin;
grant select on public.technicians to supabase_auth_admin;

-- ============================================================================
-- 3) RLS bypass 정책 멱등 재선언
--    SECURITY DEFINER 함수에서도 RLS 가 적용되는 케이스 대비 이중 안전망.
-- ============================================================================

drop policy if exists hook_read_admin_users on public.admin_users;
create policy hook_read_admin_users on public.admin_users
  for select to supabase_auth_admin using (true);

drop policy if exists hook_read_technicians on public.technicians;
create policy hook_read_technicians on public.technicians
  for select to supabase_auth_admin using (true);

-- ============================================================================
-- 4) 적용 후 진단 SQL — 본 마이그레이션 push 후 SQL Editor 에서 실행하여 검증:
--
--   -- (a) Hook 직접 호출 — 에러 없이 jsonb 반환되어야 함
--   select public.custom_access_token_hook(
--     jsonb_build_object(
--       'user_id', (select id from auth.users where email = 'super_admin_eunjin@internal.mountpartners.cloud'),
--       'claims', '{}'::jsonb
--     )
--   );
--   -- 기대 결과: claims.app_metadata.user_type='admin', admin_role='super_admin', admin_user_id 존재
--
--   -- (b) supabase_auth_admin 권한 확인
--   select has_table_privilege('supabase_auth_admin', 'public.admin_users', 'SELECT') as can_read_admin;
--   select has_table_privilege('supabase_auth_admin', 'public.technicians', 'SELECT') as can_read_tech;
--   select has_function_privilege('supabase_auth_admin',
--     'public.custom_access_token_hook(jsonb)', 'EXECUTE') as can_exec_hook;
--   -- 기대 결과: 3 모두 t (true)
-- ============================================================================
