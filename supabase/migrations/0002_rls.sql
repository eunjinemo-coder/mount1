-- ============================================================================
-- 0002_rls.sql — Row Level Security 정책
-- Source of truth: 02_IA/04_PERMISSIONS.md §5.0~§5.10 · §2.1 매트릭스
-- 원칙: 화이트리스트 — 기본 DENY. 명시 허용만 통과.
-- JWT claim 계약: app_metadata.user_type('admin'|'technician') · .admin_role · .technician_id
--   (0004_hooks.sql 의 custom_access_token_hook 이 주입)
-- ============================================================================

-- ============================================================================
-- §5.0 — 모든 테이블 RLS 활성
-- ============================================================================
alter table admin_users                  enable row level security;
alter table technicians                  enable row level security;
alter table customers                    enable row level security;
alter table coupang_order_staging        enable row level security;
alter table orders                       enable row level security;
alter table installations                enable row level security;
alter table photos                       enable row level security;
alter table issues                       enable row level security;
alter table cancellation_reports         enable row level security;
alter table happy_calls                  enable row level security;
alter table call_logs                    enable row level security;
alter table dispatches                   enable row level security;
alter table payment_links                enable row level security;
alter table payments                     enable row level security;
alter table technician_availabilities    enable row level security;
alter table notifications                enable row level security;
alter table audit_events                 enable row level security;
alter table app_settings                 enable row level security;
alter table technician_vacations         enable row level security;
alter table technician_recurring_offdays enable row level security;
alter table technician_service_areas     enable row level security;

-- ============================================================================
-- §5.1 — 헬퍼 함수 (auth schema · stable)
-- ============================================================================

create or replace function auth.admin_role()
returns text
language sql stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'admin_role'),
    ''
  );
$$;

create or replace function auth.is_admin()
returns boolean
language sql stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'user_type') = 'admin';
$$;

create or replace function auth.is_super_admin()
returns boolean
language sql stable
as $$
  select auth.admin_role() = 'super_admin';
$$;

create or replace function auth.technician_id()
returns uuid
language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'technician_id', '')::uuid;
$$;

create or replace function auth.has_admin_role(roles text[])
returns boolean
language sql stable
as $$
  select auth.admin_role() = any(roles);
$$;

-- ============================================================================
-- §5.2 — orders (5 policies)
-- ============================================================================

create policy orders_select_admin on orders for select
  using (auth.is_admin());

create policy orders_select_technician on orders for select
  using (
    auth.technician_id() is not null
    and assigned_technician_id = auth.technician_id()
  );

create policy orders_insert on orders for insert
  with check (auth.has_admin_role(array['super_admin','cs_admin','ops_admin']));

create policy orders_update_admin on orders for update
  using (auth.is_admin())
  with check (auth.is_admin());

create policy orders_delete on orders for delete
  using (auth.is_super_admin());

-- ============================================================================
-- §5.3 — customers (2 policies + 기사용 뷰)
-- ============================================================================

create policy customers_select_admin on customers for select
  using (auth.is_admin());

create policy customers_mutate on customers for all
  using (auth.has_admin_role(array['super_admin','cs_admin','ops_admin']))
  with check (auth.has_admin_role(array['super_admin','cs_admin','ops_admin']));

-- 기사용 View (§5.3) — PII 일부만 노출, 자기 배차건만
create or replace view v_customer_for_technician as
select
  c.id,
  c.phone_tail4,
  c.address_region_sido,
  c.address_region_sigungu,
  c.address_lat,
  c.address_lng
from customers c
where exists (
  select 1 from orders o
  where o.customer_id = c.id
    and o.assigned_technician_id = auth.technician_id()
    and o.status in ('assigned','en_route','on_site','in_progress',
                     'no_drill_completed','drill_converted_completed',
                     'awaiting_payment','payment_sent','paid','postponed','cancel_requested')
);

grant select on v_customer_for_technician to authenticated;

comment on view v_customer_for_technician is
  '기사 전용 고객 뷰. customers 직접 접근 금지 — 이 뷰만 조회. 암호화 PII(name/phone/address_road/address_detail)는 복호화 RPC로만.';

-- ============================================================================
-- §5.4 — photos (5 policies)
-- ============================================================================

create policy photos_select_admin on photos for select
  using (auth.is_admin());

create policy photos_select_technician on photos for select
  using (
    technician_id = auth.technician_id()
    or exists (
      select 1 from orders o
      where o.id = photos.order_id
        and o.assigned_technician_id = auth.technician_id()
    )
  );

create policy photos_insert_technician on photos for insert
  with check (
    technician_id = auth.technician_id()
    and exists (
      select 1 from orders o
      where o.id = photos.order_id
        and o.assigned_technician_id = auth.technician_id()
        and o.status in ('on_site','in_progress')
    )
  );

create policy photos_update_admin on photos for update
  using (auth.is_admin())
  with check (auth.is_admin());

create policy photos_delete on photos for delete
  using (auth.is_super_admin());

-- ============================================================================
-- §5.5 — issues (3) + cancellation_reports (3)
-- ============================================================================

create policy issues_insert_technician on issues for insert
  with check (
    technician_id = auth.technician_id()
    and exists (
      select 1 from orders o
      where o.id = issues.order_id
        and o.assigned_technician_id = auth.technician_id()
    )
  );

create policy issues_select_own on issues for select
  using (technician_id = auth.technician_id() or auth.is_admin());

create policy issues_mutate_admin on issues for update
  using (auth.is_admin())
  with check (auth.is_admin());

create policy cancel_insert_technician on cancellation_reports for insert
  with check (
    technician_id = auth.technician_id()
    and exists (
      select 1 from orders o
      where o.id = cancellation_reports.order_id
        and o.assigned_technician_id = auth.technician_id()
    )
  );

create policy cancel_select_own on cancellation_reports for select
  using (technician_id = auth.technician_id() or auth.is_admin());

create policy cancel_update_admin on cancellation_reports for update
  using (auth.has_admin_role(array['super_admin','cs_admin','ops_admin']))
  with check (auth.has_admin_role(array['super_admin','cs_admin','ops_admin']));

-- ============================================================================
-- §5.6 — payments (2) + payment_links (1) · 기사 완전 차단
-- ============================================================================

create policy payments_admin_all on payments for all
  using (auth.has_admin_role(array['super_admin','ops_admin']))
  with check (auth.has_admin_role(array['super_admin','ops_admin']));

create policy payments_auditor_read on payments for select
  using (auth.admin_role() = 'auditor');

create policy payment_links_admin_all on payment_links for all
  using (auth.has_admin_role(array['super_admin','ops_admin']))
  with check (auth.has_admin_role(array['super_admin','ops_admin']));

-- ============================================================================
-- §5.7a — technicians (3)
-- ============================================================================

create policy technicians_select_self on technicians for select
  using (id = auth.technician_id() or auth.is_admin());

create policy technicians_update_self on technicians for update
  using (id = auth.technician_id())
  with check (id = auth.technician_id());

create policy technicians_admin_all on technicians for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

-- ============================================================================
-- §5.7b — 근무관리 4 테이블 (self CRUD + admin override + read)
-- ============================================================================

-- 기사 본인 CRUD
create policy avail_self on technician_availabilities for all
  using (technician_id = auth.technician_id())
  with check (technician_id = auth.technician_id());

create policy vacation_self on technician_vacations for all
  using (technician_id = auth.technician_id())
  with check (technician_id = auth.technician_id());

create policy offday_self on technician_recurring_offdays for all
  using (technician_id = auth.technician_id())
  with check (technician_id = auth.technician_id());

create policy area_self on technician_service_areas for all
  using (technician_id = auth.technician_id())
  with check (technician_id = auth.technician_id());

-- 배차담당/대표 override
create policy avail_admin on technician_availabilities for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

create policy vacation_admin on technician_vacations for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

create policy offday_admin on technician_recurring_offdays for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

create policy area_admin on technician_service_areas for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

-- CS·Ops·감사 읽기 전용
create policy avail_read on technician_availabilities for select
  using (auth.has_admin_role(array['cs_admin','ops_admin','auditor']));

create policy vacation_read on technician_vacations for select
  using (auth.has_admin_role(array['cs_admin','ops_admin','auditor']));

create policy offday_read on technician_recurring_offdays for select
  using (auth.has_admin_role(array['cs_admin','ops_admin','auditor']));

create policy area_read on technician_service_areas for select
  using (auth.has_admin_role(array['cs_admin','ops_admin','auditor']));

-- ============================================================================
-- §5.9 — call_logs (2) + installations (2)
-- ============================================================================

create policy call_logs_insert_tech on call_logs for insert
  with check (
    technician_id = auth.technician_id()
    and exists (
      select 1 from orders o
      where o.id = call_logs.order_id
        and o.assigned_technician_id = auth.technician_id()
    )
  );

create policy call_logs_select on call_logs for select
  using (technician_id = auth.technician_id() or auth.is_admin());

create policy install_select_tech on installations for select
  using (technician_id = auth.technician_id() or auth.is_admin());

create policy install_update_tech on installations for update
  using (technician_id = auth.technician_id() or auth.is_admin())
  with check (technician_id = auth.technician_id() or auth.is_admin());

-- ============================================================================
-- §5.10 — audit_events (2) + app_settings (2)
-- ============================================================================

create policy audit_auditor_all on audit_events for select
  using (auth.admin_role() in ('auditor','super_admin'));

create policy audit_self on audit_events for select
  using (actor_id = auth.uid());

create policy app_settings_super on app_settings for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());

create policy app_settings_public_read on app_settings for select
  using (
    key in ('weekend_operation_global','contact_info','version_banner')
    and auth.uid() is not null
  );

-- ============================================================================
-- §2.1 매트릭스 보강 — 나머지 테이블 정책
--   ERD 21 테이블 전체 RLS 완전 커버 목적. PERMISSIONS §5 본문에 SQL 예시 없는 부분을
--   §2.1 매트릭스 ·§2.2 (기사 영역) 규칙에 따라 명시.
-- ============================================================================

-- admin_users — 대표 CRUD · 감사 R · 본인 R
create policy admin_users_super_all on admin_users for all
  using (auth.is_super_admin())
  with check (auth.is_super_admin());

create policy admin_users_select_self on admin_users for select
  using (auth_user_id = auth.uid());

create policy admin_users_select_auditor on admin_users for select
  using (auth.admin_role() = 'auditor');

-- coupang_order_staging — ops_admin + super_admin CRUD · 감사 R
create policy staging_ops_all on coupang_order_staging for all
  using (auth.has_admin_role(array['super_admin','ops_admin']))
  with check (auth.has_admin_role(array['super_admin','ops_admin']));

create policy staging_auditor_read on coupang_order_staging for select
  using (auth.admin_role() = 'auditor');

-- happy_calls — cs_admin + super_admin CRUD · 나머지 관리자 R
create policy happy_calls_cs_all on happy_calls for all
  using (auth.has_admin_role(array['super_admin','cs_admin']))
  with check (auth.has_admin_role(array['super_admin','cs_admin']));

create policy happy_calls_admin_read on happy_calls for select
  using (auth.has_admin_role(array['dispatch_admin','ops_admin','auditor']));

-- dispatches — dispatch_admin + super_admin CRUD · 나머지 관리자 R
create policy dispatches_dispatch_all on dispatches for all
  using (auth.has_admin_role(array['super_admin','dispatch_admin']))
  with check (auth.has_admin_role(array['super_admin','dispatch_admin']));

create policy dispatches_admin_read on dispatches for select
  using (auth.has_admin_role(array['cs_admin','ops_admin','auditor']));

-- notifications — admin CRUD · 기사 자기건 R (recipient_id 일치)
create policy notifications_admin_all on notifications for all
  using (auth.is_admin())
  with check (auth.is_admin());

create policy notifications_tech_read on notifications for select
  using (
    recipient_type = 'technician'
    and recipient_id = auth.technician_id()
  );
