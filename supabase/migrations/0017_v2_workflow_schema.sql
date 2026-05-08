-- ============================================================================
-- 0017_v2_workflow_schema.sql — Driver Workflow v2: Schema + RLS + RPC
-- Branch: feat/driver-workflow-v2
-- Tasks: 1.1~1.7 (8 sections)
-- Pre-deploy check (run before apply, NOT part of migration):
--   select id, status, scheduled_installation_at from orders
--   where status in ('en_route','on_site','in_progress')
--   order by scheduled_installation_at;
--   -- Must return 0 rows before deploying.
-- ============================================================================

-- ============================================================================
-- §1.1 — orders.customer_consent_confirmed
-- (option_selected and conversion_from_no_drill already exist in 0001_init.sql)
-- ============================================================================

alter table orders
  add column customer_consent_confirmed boolean not null default false;

comment on column orders.customer_consent_confirmed is
  'driver /complete 화면에서 기사 self-report — 신분증·결제 안내 완료. 분쟁 시 증거.';

-- ============================================================================
-- §1.2 — issues admin response columns
-- ============================================================================

alter table issues add column admin_response_text text;
alter table issues add column admin_response_at timestamptz;
alter table issues add column admin_responder_id uuid references admin_users(id);

comment on column issues.admin_response_text is
  '본사 1:1 응답. driver 이슈 이력 emerald 라인으로 표시.';

-- ============================================================================
-- §1.3 — photos_insert_technician RLS: expand to 'assigned' status
-- Drop and recreate — original policy (0002_rls.sql) only allowed on_site/in_progress.
-- ============================================================================

drop policy if exists photos_insert_technician on photos;

create policy photos_insert_technician on photos for insert
  with check (
    technician_id = public.technician_id()
    and exists (
      select 1 from orders o
      where o.id = photos.order_id
        and o.assigned_technician_id = public.technician_id()
        and o.status in ('assigned','en_route','on_site','in_progress')
    )
  );

-- ============================================================================
-- §1.4 — RPC update_schedule_by_technician (1-hour minimum window)
-- ============================================================================

create or replace function public.update_schedule_by_technician(
  p_order_id       uuid,
  p_new_scheduled_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech            uuid := public.technician_id();
  v_assigned_tech   uuid;
  v_status          text;
begin
  -- auth check
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- fetch and lock the order row
  select assigned_technician_id, status
    into v_assigned_tech, v_status
    from orders
   where id = p_order_id
   for update;

  if v_assigned_tech is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_assigned_tech <> v_tech then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status <> 'assigned' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  -- time validation (after ownership/status confirmed)
  if p_new_scheduled_at - now() <= interval '1 hour' then
    raise exception 'window_closed' using errcode = 'P0001';
  end if;
  if p_new_scheduled_at <= now() then
    raise exception 'past_time' using errcode = 'P0001';
  end if;

  -- apply update
  update orders
     set scheduled_installation_at = p_new_scheduled_at
   where id = p_order_id;

  return jsonb_build_object(
    'ok',     true,
    'new_at', p_new_scheduled_at
  );
end;
$$;

revoke all on function public.update_schedule_by_technician(uuid, timestamptz) from public, anon;
grant execute on function public.update_schedule_by_technician(uuid, timestamptz) to authenticated;

-- ============================================================================
-- §1.5 — issues RLS policies (additive — no existing policy dropped)
-- Existing in 0002_rls.sql: issues_insert_technician, issues_select_own,
--   issues_mutate_admin.
-- New policies use distinct names to avoid collision.
-- ============================================================================

-- v2 insert: explicitly requires assignment linkage (belt-and-suspenders over existing)
-- NOTE: issues_insert_technician already exists in 0002_rls.sql and cannot be recreated.
-- The existing policy already covers the base insert requirement.
-- We add the refined select-per-assignment and admin-response-only update policies.

-- 주의: 0002_rls.sql 의 issues_select_own (technician_id 직접 매치) 과 OR 조건으로 동작 — 의도된 중복.
-- 본 정책은 order assignment 기준으로 검사하여 admin이 issues.technician_id 변경한 케이스도 커버한다.
create policy issues_select_technician on issues for select
  using (
    exists (
      select 1 from orders o
      where o.id = issues.order_id
        and o.assigned_technician_id = public.technician_id()
    )
  );

create policy issues_update_admin_response on issues for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- §1.6 — admin_alerts table + schedule-change trigger
-- ============================================================================

create table admin_alerts (
  id              uuid        primary key default gen_random_uuid(),
  type            text        not null,
  order_id        uuid        references orders(id) on delete cascade,
  technician_id   uuid        references technicians(id),
  payload         jsonb,
  created_at      timestamptz default now(),
  acknowledged_at timestamptz
);

create index idx_admin_alerts_unack
  on admin_alerts(created_at desc)
  where acknowledged_at is null;

-- RLS: admin read + update only; INSERT via security definer triggers/functions
alter table admin_alerts enable row level security;

create policy admin_alerts_select_admin on admin_alerts for select
  using (public.is_admin());

create policy admin_alerts_update_admin on admin_alerts for update
  using (public.is_admin())
  with check (public.is_admin());

grant select, update on admin_alerts to authenticated;

-- Trigger function: fires when a technician changes scheduled_installation_at
create or replace function public.notify_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only react to technician-originated updates (technician_id() not null)
  -- and only when scheduled_installation_at actually changed.
  if public.technician_id() is not null
     and new.scheduled_installation_at is distinct from old.scheduled_installation_at
  then
    insert into admin_alerts (type, order_id, technician_id, payload)
    values (
      'schedule_changed_by_technician',
      new.id,
      public.technician_id(),
      jsonb_build_object(
        'old_at', old.scheduled_installation_at,
        'new_at', new.scheduled_installation_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_notify_schedule on orders;

create trigger trg_orders_notify_schedule
  after update on orders
  for each row
  execute function public.notify_schedule_change();

-- ============================================================================
-- §1.7 — RPC complete_install_atomic
-- ============================================================================

create or replace function public.complete_install_atomic(
  p_order_id          uuid,
  p_option_selected   text,
  p_conversion        boolean,
  p_consent_confirmed boolean,
  p_memo              text,
  p_photo_pre_count   int,
  p_photo_post_count  int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech          uuid := public.technician_id();
  v_assigned_tech uuid;
  v_status        text;
  v_special_notes text;
  v_new_status    text;
begin
  -- auth check
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- fetch and lock the order row
  select assigned_technician_id, status, special_notes
    into v_assigned_tech, v_status, v_special_notes
    from orders
   where id = p_order_id
   for update;

  if v_assigned_tech is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_assigned_tech <> v_tech then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status <> 'assigned' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  if p_option_selected not in ('A_stand','B_drill','C_no_drill') then
    raise exception 'invalid_option: %', p_option_selected using errcode = 'P0001';
  end if;

  -- determine new status
  if p_conversion then
    v_new_status := 'drill_converted_completed';
  else
    v_new_status := 'no_drill_completed';
  end if;

  -- build updated special_notes (append v2 memo if provided)
  -- Idempotency note: 같은 RPC를 재호출해도 v_status='assigned' 가드(위)가 두 번째 호출을 invalid_status로 거부하므로 메모 중복 append는 발생하지 않는다. 만약 그 가드가 완화되면 이 부분을 `and v_special_notes not like '%[v2 memo] ' || trim(p_memo) || '%'` 형태의 dedup 가드로 보강해야 한다.
  if p_memo is not null and length(trim(p_memo)) > 0 then
    v_special_notes := coalesce(v_special_notes || E'\n', '') || '[v2 memo] ' || trim(p_memo);
  end if;

  -- apply order update
  update orders
     set status                    = v_new_status,
         status_changed_at         = now(),
         customer_consent_confirmed = p_consent_confirmed,
         special_notes             = v_special_notes,
         conversion_from_no_drill  = p_conversion,
         option_selected           = p_option_selected
   where id = p_order_id;

  -- insert warning alert when completion conditions are sub-threshold
  if p_photo_pre_count < 2
     or p_photo_post_count < 3
     or not p_consent_confirmed
  then
    insert into admin_alerts (type, order_id, technician_id, payload)
    values (
      'completion_with_warnings',
      p_order_id,
      v_tech,
      jsonb_build_object(
        'photo_pre_count',   p_photo_pre_count,
        'photo_post_count',  p_photo_post_count,
        'consent_confirmed', p_consent_confirmed,
        'new_status',        v_new_status
      )
    );
  end if;

  return jsonb_build_object(
    'ok',         true,
    'new_status', v_new_status
  );
end;
$$;

revoke all on function public.complete_install_atomic(uuid, text, boolean, boolean, text, int, int) from public, anon;
grant execute on function public.complete_install_atomic(uuid, text, boolean, boolean, text, int, int) to authenticated;
