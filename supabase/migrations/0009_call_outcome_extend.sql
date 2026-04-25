-- ============================================================================
-- 0009_call_outcome_extend.sql — 30분 전 통화 결과 5종 → 7종 확장
-- Source: 와이어프레임 A05 §통화 결과 + 3차 UI/UX 보고서 P1-N3
--
-- 추가 결과 2종:
--   · customer_postponed   — 고객 연기 요청 (예: "내일로 변경 가능?")
--   · customer_cancelled   — 고객 취소 요청 (전화로 취소 의사 표현)
--
-- 후속 흐름:
--   · postponed → 관리자 일정 재조정 화면 (R8)
--   · cancelled → 자동 A10 취소 리포트 진입 (R8)
-- ============================================================================

-- 1) call_logs.call_outcome check 제약 확장
alter table call_logs drop constraint if exists call_logs_call_outcome_check;
alter table call_logs add constraint call_logs_call_outcome_check
  check (call_outcome in (
    'answered',
    'no_answer',
    'busy',
    'unreachable',
    'manual_marked_done',
    'customer_postponed',
    'customer_cancelled'
  ));

-- 2) rpc_technician_log_call 의 outcome 검증 확장
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

  if p_outcome not in (
    'answered', 'no_answer', 'busy', 'unreachable', 'manual_marked_done',
    'customer_postponed', 'customer_cancelled'
  ) then
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

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end;
$$;
