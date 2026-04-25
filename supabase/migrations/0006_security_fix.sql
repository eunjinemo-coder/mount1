-- ============================================================================
-- 0006_security_fix.sql — 1차 중간점검 P0/P1 보안 fix
-- Source: D:\MOUNT1\_REVIEW_REPORTS\MIDPOINT_CHECK_2026-04-25.md (P0-3·P0-4·P0-5 + P1-S5)
-- ============================================================================

-- ============================================================================
-- P0-3: auditor 권한 분리 — is_admin() 헬퍼는 auditor 도 통과시켜
--   감사자가 orders/photos/issues/installations/notifications 쓰기 권한을 획득함.
--   쓰기 정책 5개를 has_admin_role(array[..., auditor 제외]) 로 교체.
-- ============================================================================

drop policy if exists orders_update_admin on orders;
create policy orders_update_admin on orders for update
  using (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']));

drop policy if exists photos_update_admin on photos;
create policy photos_update_admin on photos for update
  using (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']));

drop policy if exists issues_mutate_admin on issues;
create policy issues_mutate_admin on issues for update
  using (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']));

drop policy if exists install_update_tech on installations;
create policy install_update_tech on installations for update
  using (
    technician_id = public.technician_id()
    or public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin'])
  )
  with check (
    technician_id = public.technician_id()
    or public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin'])
  );

drop policy if exists notifications_admin_all on notifications;
create policy notifications_admin_all on notifications for all
  using (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','cs_admin','dispatch_admin','ops_admin']));

-- auditor 는 별도 read-only 정책 (5 테이블)
create policy orders_select_auditor on orders for select
  using (public.admin_role() = 'auditor');

create policy photos_select_auditor on photos for select
  using (public.admin_role() = 'auditor');

create policy issues_select_auditor on issues for select
  using (public.admin_role() = 'auditor');

create policy install_select_auditor on installations for select
  using (public.admin_role() = 'auditor');

create policy notifications_select_auditor on notifications for select
  using (public.admin_role() = 'auditor');

-- ============================================================================
-- P0-4: 트리거 함수 search_path 고정 — search_path injection 방어
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_order_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into audit_events (actor_type, action, subject_type, subject_id, before_value, after_value)
    values (
      coalesce(current_setting('app.current_actor_type', true), 'system'),
      'order.status_change',
      'order', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.audit_lead_time_override()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scheduled_installation_at is not null
     and new.scheduled_installation_at < new.order_received_at + interval '2 days' then
    insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
    values (
      coalesce(current_setting('app.current_actor_type', true), 'system'),
      'order.lead_time_override',
      'order', new.id,
      jsonb_build_object(
        'order_received_at', new.order_received_at,
        'scheduled', new.scheduled_installation_at,
        'delta_hours', extract(epoch from (new.scheduled_installation_at - new.order_received_at)) / 3600
      )
    );
  end if;
  return new;
end;
$$;

-- ============================================================================
-- P0-5: 뷰 security_invoker = true — RLS 우회 차단
--   PostgreSQL 15+ 에서 뷰 기본은 owner 권한 실행. invoker 모드로 호출자 권한 평가.
-- ============================================================================

alter view v_orders_dashboard set (security_invoker = true);
alter view v_technician_today set (security_invoker = true);
-- v_customer_for_technician 은 0002_rls.sql 에 생성됨
alter view v_customer_for_technician set (security_invoker = true);

-- ============================================================================
-- P1-S5: notifications.idempotency_key not null — 중복 알림 방지
--   기존 행 보강 후 not null 제약 추가.
-- ============================================================================

-- 1) 기존 NULL 행에 임시 키 채움 (id 기반 결정성 키)
update notifications
   set idempotency_key = 'legacy_' || id::text
 where idempotency_key is null;

-- 2) not null 제약 추가
alter table notifications
  alter column idempotency_key set not null;

-- ============================================================================
-- 적용 확인 — 본 마이그레이션 적용 후 다음 SQL 로 검증 가능:
--   select policyname from pg_policies where tablename = 'orders' and policyname like 'orders_%';
--   select prosrc from pg_proc where proname = 'set_updated_at' and prosrc like '%search_path%';
--   select c.relname, c.reloptions from pg_class c where c.relname like 'v_%';
-- ============================================================================
