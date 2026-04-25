-- ============================================================================
-- 0004_hooks.sql — Custom Access Token Hook
-- Source of truth: 05_TECH_STACK/06_EXTENSIBILITY_ARCHITECTURE.md §8
--                  + 02_IA/04_PERMISSIONS.md §4.1 (JWT claim 구조)
-- 목적: Supabase Auth 가 JWT 를 발급할 때 app_metadata 에 다음을 주입:
--   · user_type      : 'admin' | 'technician'
--   · admin_role     : super_admin | cs_admin | dispatch_admin | ops_admin | auditor  (admin 만)
--   · admin_user_id  : admin_users.id  (admin 만)
--   · technician_id  : technicians.id  (technician 만)
--
-- 배포 후 수동 설정:
--   Dashboard → Authentication → Hooks → "Custom Access Token" 활성화 →
--   Function: public.custom_access_token_hook
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

  -- app_metadata 객체 보장
  if claims->'app_metadata' is null or jsonb_typeof(claims->'app_metadata') <> 'object' then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- (1) admin_users 우선 조회
  select id, role
    into v_admin
    from public.admin_users
   where auth_user_id = v_user_id
     and status = 'active'
   limit 1;

  if found then
    claims := jsonb_set(claims, '{app_metadata,user_type}',     to_jsonb('admin'::text));
    claims := jsonb_set(claims, '{app_metadata,admin_role}',    to_jsonb(v_admin.role));
    claims := jsonb_set(claims, '{app_metadata,admin_user_id}', to_jsonb(v_admin.id));
    claims := jsonb_set(claims, '{app_metadata,technician_id}', 'null'::jsonb);
  else
    -- (2) technicians 조회
    select id into v_tech_id
      from public.technicians
     where auth_user_id = v_user_id
       and status = 'active'
     limit 1;

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
-- 권한 — supabase_auth_admin 전용
-- ============================================================================

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- hook 내부에서 admin_users / technicians 조회 필요 (SECURITY DEFINER 로 실행되지만
-- 명시적 권한 부여로 권한 검증 경고 회피)
grant select on public.admin_users to supabase_auth_admin;
grant select on public.technicians to supabase_auth_admin;

-- admin_users / technicians 에 supabase_auth_admin 전용 RLS bypass 정책 추가
-- (SECURITY DEFINER 로도 충분하지만 이중 안전망)
create policy hook_read_admin_users on public.admin_users
  for select to supabase_auth_admin using (true);

create policy hook_read_technicians on public.technicians
  for select to supabase_auth_admin using (true);
