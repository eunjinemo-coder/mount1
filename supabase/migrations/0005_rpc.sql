-- ============================================================================
-- 0005_rpc.sql — 시공 워크플로우 RPC (SECURITY DEFINER · RLS 우회 atomic 작업)
-- Source of truth: 02_IA/04_PERMISSIONS.md §6
-- 네이밍: ERD §3 컬럼 단일 원천 (audit_events.action · notifications.recipient_type 등)
-- 헬퍼: 0002_rls.sql 의 public.technician_id() 등 사용
-- ============================================================================

-- ============================================================================
-- §6.1 — rpc_technician_start_installation
--   on_site → in_progress · 사진 2장(pre_tv_screen·pre_wall) 검증
-- ============================================================================
create or replace function public.rpc_technician_start_installation(
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_order orders%rowtype;
  v_photo_count int;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_order.assigned_technician_id <> v_tech then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  if v_order.status <> 'on_site' then
    raise exception 'invalid_from_status: %', v_order.status using errcode = 'P0001';
  end if;

  -- 가드: 시공 전 필수 사진 2장 (pre_tv_screen + pre_wall)
  select count(*) into v_photo_count
  from photos
  where order_id = p_order_id
    and slot in ('pre_tv_screen', 'pre_wall');

  if v_photo_count < 2 then
    raise exception 'missing_pre_photos' using errcode = 'P0001';
  end if;

  update orders
     set status = 'in_progress',
         status_changed_at = now()
   where id = p_order_id;

  update installations
     set started_at = now()
   where order_id = p_order_id;

  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'order.start_installation',
    'order',
    p_order_id,
    jsonb_build_object('technician_id', v_tech, 'started_at', now())
  );

  return jsonb_build_object('ok', true, 'new_status', 'in_progress');
end;
$$;

revoke all on function public.rpc_technician_start_installation(uuid) from public, anon;
grant execute on function public.rpc_technician_start_installation(uuid) to authenticated;

-- ============================================================================
-- §6.2 — rpc_technician_complete
--   in_progress → no_drill_completed | drill_converted_completed
--   사진 3장(post_front·post_left·post_right) 검증
--   drill_converted 시 conversion_difference_amount 자동 계산
-- ============================================================================
create or replace function public.rpc_technician_complete(
  p_order_id uuid,
  p_variant text,
  p_conversion_agreed_method text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_order orders%rowtype;
  v_photo_count int;
  v_diff numeric(12,2);
  v_new_status text;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_variant not in ('no_drill', 'drill_converted') then
    raise exception 'invalid_variant: %', p_variant using errcode = 'P0001';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_order.assigned_technician_id <> v_tech then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  if v_order.status <> 'in_progress' then
    raise exception 'invalid_from_status: %', v_order.status using errcode = 'P0001';
  end if;

  -- 가드: 완료 필수 사진 3장
  select count(*) into v_photo_count
  from photos
  where order_id = p_order_id
    and slot in ('post_front', 'post_left', 'post_right');

  if v_photo_count < 3 then
    raise exception 'missing_post_photos' using errcode = 'P0001';
  end if;

  if p_variant = 'drill_converted' then
    if p_conversion_agreed_method is null then
      raise exception 'conversion_method_required' using errcode = 'P0001';
    end if;
    if p_conversion_agreed_method not in ('verbal', 'sms', 'phone') then
      raise exception 'invalid_conversion_method' using errcode = 'P0001';
    end if;

    v_diff := v_order.price_option_b - v_order.price_option_c;
    v_new_status := 'drill_converted_completed';

    update orders
       set status = v_new_status,
           status_changed_at = now(),
           conversion_from_no_drill = true,
           conversion_difference_amount = v_diff,
           conversion_agreed_method = p_conversion_agreed_method,
           conversion_agreed_at = now()
     where id = p_order_id;
  else
    v_new_status := 'no_drill_completed';
    update orders
       set status = v_new_status,
           status_changed_at = now()
     where id = p_order_id;
  end if;

  update installations
     set completed_at = now(),
         result_type = case
           when p_variant = 'drill_converted' then 'drill_converted'
           else 'no_drill_success'
         end
   where order_id = p_order_id;

  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'order.complete_' || p_variant,
    'order',
    p_order_id,
    jsonb_build_object(
      'technician_id', v_tech,
      'variant', p_variant,
      'conversion_diff', v_diff,
      'completed_at', now()
    )
  );

  -- 후속: 결제링크 발송 큐 등록 (드릴 전환은 차액만, 무타공은 무액)
  if p_variant = 'drill_converted' then
    insert into notifications (order_id, recipient_type, channel, template_id, payload, status)
    values (
      p_order_id,
      'customer',
      'sms',
      'PAYMENT_LINK_CONVERSION',
      jsonb_build_object('amount', v_diff, 'order_id', p_order_id),
      'queued'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'new_status', v_new_status,
    'conversion_diff', v_diff
  );
end;
$$;

revoke all on function public.rpc_technician_complete(uuid, text, text) from public, anon;
grant execute on function public.rpc_technician_complete(uuid, text, text) to authenticated;

-- ============================================================================
-- §6.3 — rpc_technician_log_call (30분 전 통화 의무 액션)
--   call_logs insert + audit_events
-- ============================================================================
create or replace function public.rpc_technician_log_call(
  p_order_id uuid,
  p_type text default 'pre_arrival_30min',
  p_outcome text default 'manual_marked_done',
  p_duration_seconds int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_order_assigned uuid;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_type not in ('pre_arrival_30min', 'post_arrival', 'on_demand') then
    raise exception 'invalid_call_type' using errcode = 'P0001';
  end if;

  if p_outcome not in ('answered', 'no_answer', 'busy', 'unreachable', 'manual_marked_done') then
    raise exception 'invalid_call_outcome' using errcode = 'P0001';
  end if;

  select assigned_technician_id into v_order_assigned from orders where id = p_order_id;
  if v_order_assigned is null or v_order_assigned <> v_tech then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  insert into call_logs (order_id, technician_id, type, called_at, call_duration_seconds, call_outcome)
  values (p_order_id, v_tech, p_type, now(), p_duration_seconds, p_outcome);

  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'order.call_logged',
    'order',
    p_order_id,
    jsonb_build_object('type', p_type, 'outcome', p_outcome)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rpc_technician_log_call(uuid, text, text, int) from public, anon;
grant execute on function public.rpc_technician_log_call(uuid, text, text, int) to authenticated;

-- ============================================================================
-- §6.3 — rpc_admin_dispatch (간단 버전 — 수동 배차)
--   scheduled → assigned · 알고리즘 추천은 Phase 2 에서 강화
--   dispatch_admin·super_admin 만 호출 가능
-- ============================================================================
create or replace function public.rpc_admin_dispatch(
  p_order_id uuid,
  p_technician_id uuid,
  p_override_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text := public.admin_role();
  v_admin_user_id uuid;
  v_order_status text;
  v_tech_status text;
begin
  if v_actor_role not in ('super_admin', 'dispatch_admin') then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- admin_user_id 추출 (감사용)
  select nullif(auth.jwt() -> 'app_metadata' ->> 'admin_user_id', '')::uuid
    into v_admin_user_id;

  -- 주문 상태 검증
  select status into v_order_status from orders where id = p_order_id for update;
  if v_order_status is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_order_status not in ('received', 'happy_call_done', 'scheduled', 'assigned', 'postponed') then
    raise exception 'invalid_from_status: %', v_order_status using errcode = 'P0001';
  end if;

  -- 기사 활성 검증
  select status into v_tech_status from technicians where id = p_technician_id;
  if v_tech_status is null then
    raise exception 'technician_not_found' using errcode = 'P0001';
  end if;
  if v_tech_status <> 'active' then
    raise exception 'technician_inactive' using errcode = 'P0001';
  end if;

  -- 주문 update
  update orders
     set assigned_technician_id = p_technician_id,
         assigned_at = now(),
         status = 'assigned',
         status_changed_at = now()
   where id = p_order_id;

  -- installations row 생성 (없으면)
  insert into installations (order_id, technician_id)
  values (p_order_id, p_technician_id)
  on conflict (order_id) do update
    set technician_id = excluded.technician_id;

  -- dispatches 이력
  insert into dispatches (order_id, technician_id, assigned, assigned_at, assigned_by_admin_user_id, override_reason)
  values (p_order_id, p_technician_id, true, now(), v_admin_user_id, p_override_reason);

  -- 감사 로그
  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'admin',
    auth.uid(),
    'order.dispatch',
    'order',
    p_order_id,
    jsonb_build_object(
      'technician_id', p_technician_id,
      'admin_user_id', v_admin_user_id,
      'override_reason', p_override_reason
    )
  );

  -- 알림 (기사에게)
  insert into notifications (order_id, recipient_type, recipient_id, channel, template_id, payload, status)
  values (
    p_order_id,
    'technician',
    p_technician_id,
    'push',
    'DISPATCH_ASSIGNED',
    jsonb_build_object('order_id', p_order_id),
    'queued'
  );

  return jsonb_build_object('ok', true, 'assigned_technician_id', p_technician_id);
end;
$$;

revoke all on function public.rpc_admin_dispatch(uuid, uuid, text) from public, anon;
grant execute on function public.rpc_admin_dispatch(uuid, uuid, text) to authenticated;

-- ============================================================================
-- 상태 전이 helpers (간단 RPC — depart/arrive)
-- ============================================================================
create or replace function public.rpc_technician_depart(
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_status text;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select status into v_status from orders
    where id = p_order_id and assigned_technician_id = v_tech for update;
  if v_status is null then
    raise exception 'not_your_order' using errcode = '42501';
  end if;
  if v_status <> 'assigned' then
    raise exception 'invalid_from_status: %', v_status using errcode = 'P0001';
  end if;

  update orders set status = 'en_route', status_changed_at = now() where id = p_order_id;
  update installations set departed_at = now() where order_id = p_order_id;

  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id)
  values ('technician', auth.uid(), 'order.depart', 'order', p_order_id);

  return jsonb_build_object('ok', true, 'new_status', 'en_route');
end;
$$;

revoke all on function public.rpc_technician_depart(uuid) from public, anon;
grant execute on function public.rpc_technician_depart(uuid) to authenticated;

create or replace function public.rpc_technician_arrive(
  p_order_id uuid,
  p_lat numeric default null,
  p_lng numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_status text;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select status into v_status from orders
    where id = p_order_id and assigned_technician_id = v_tech for update;
  if v_status is null then
    raise exception 'not_your_order' using errcode = '42501';
  end if;
  if v_status <> 'en_route' then
    raise exception 'invalid_from_status: %', v_status using errcode = 'P0001';
  end if;

  update orders set status = 'on_site', status_changed_at = now() where id = p_order_id;
  update installations
     set arrived_at = now(),
         arrived_lat = p_lat,
         arrived_lng = p_lng
   where order_id = p_order_id;

  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'order.arrive',
    'order',
    p_order_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng)
  );

  return jsonb_build_object('ok', true, 'new_status', 'on_site');
end;
$$;

revoke all on function public.rpc_technician_arrive(uuid, numeric, numeric) from public, anon;
grant execute on function public.rpc_technician_arrive(uuid, numeric, numeric) to authenticated;
