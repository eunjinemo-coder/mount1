-- ============================================================================
-- 0016_rpc_cancel_atomic.sql — 취소 보고 + status 전이 단일 트랜잭션
-- Source: code-reviewer + architect 점검 P0-4
--
-- 문제: driver cancel/actions.ts 가 cancellation_reports INSERT 후 별개 트랜잭션으로
--       orders.status='cancel_requested' UPDATE — 부분 실패 시 데이터 부정합.
-- 해결: 단일 RPC 안에서 두 mutation 처리 → atomic guarantee.
--       valid from-status 검증 + 사진 자동 첨부 + audit_events 함께.
-- ============================================================================

create or replace function public.rpc_technician_request_cancel(
  p_order_id uuid,
  p_category text,
  p_situation_note text,
  p_signature_image_url text,
  p_photo_ids uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tech uuid := public.technician_id();
  v_order_assigned uuid;
  v_order_status text;
  v_photo_ids uuid[];
  v_report_id uuid;
begin
  if v_tech is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_category not in (
    'no_drill_structural', 'conversion_declined', 'customer_absent_3times',
    'address_issue', 'tv_model_mismatch', 'etc'
  ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;

  if p_situation_note is null or length(trim(p_situation_note)) < 10 then
    raise exception 'situation_note_too_short' using errcode = 'P0001';
  end if;

  -- order 검증 (lock + 본인 배차 + valid from-status)
  select assigned_technician_id, status into v_order_assigned, v_order_status
    from orders where id = p_order_id for update;

  if v_order_assigned is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order_assigned <> v_tech then
    raise exception 'not_your_order' using errcode = '42501';
  end if;
  if v_order_status not in ('assigned', 'en_route', 'on_site', 'in_progress') then
    raise exception 'invalid_from_status' using errcode = 'P0001';
  end if;

  -- 사진 자동 첨부 (caller 명시 우선, 없으면 본인+본 order 사진 모두)
  if p_photo_ids is null or array_length(p_photo_ids, 1) is null then
    select coalesce(array_agg(id), '{}'::uuid[]) into v_photo_ids
      from photos
     where order_id = p_order_id and technician_id = v_tech;
  else
    -- caller 명시 ID 가 본인+본 order 인지 검증
    select coalesce(array_agg(id), '{}'::uuid[]) into v_photo_ids
      from photos
     where id = any(p_photo_ids)
       and order_id = p_order_id
       and technician_id = v_tech;
  end if;

  -- cancellation_reports INSERT
  insert into cancellation_reports (
    order_id, technician_id, category_primary, sub_reasons,
    situation_note, photo_ids, signature_image_url, coupang_transfer_status
  ) values (
    p_order_id, v_tech, p_category, '{}',
    p_situation_note, v_photo_ids, p_signature_image_url, 'pending'
  )
  returning id into v_report_id;

  -- orders status 전이 (atomic)
  update orders
     set status = 'cancel_requested',
         status_changed_at = now()
   where id = p_order_id;

  -- audit
  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values (
    'technician',
    auth.uid(),
    'order.cancel_requested',
    'order',
    p_order_id,
    jsonb_build_object(
      'category', p_category,
      'report_id', v_report_id,
      'photo_count', coalesce(array_length(v_photo_ids, 1), 0)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'report_id', v_report_id,
    'photo_count', coalesce(array_length(v_photo_ids, 1), 0)
  );
end;
$$;

revoke all on function public.rpc_technician_request_cancel(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.rpc_technician_request_cancel(uuid, text, text, text, uuid[]) to authenticated;
