-- ============================================================================
-- 0023_store_ops.sql — P0 스토어 운영면 (운송장 · 발송 큐 · 크론 스캔)
-- Source of truth: 02_PRD_P0_STORE.md §4(자동화/크론) · §5(멱등) · §6(오류)
--   + 은진님 2026-07-03 결정: 주문 알림 = Solapi 카카오 알림톡(SMS/LMS 폴백),
--     SMS 비용폭탄 방지 — 주문 생성(anon) 시엔 "은진님(고정 발신대상)"에게만 발송,
--     구매자 대상 발송은 입금확인/발송(admin 수동 트리거) 이후에만.
--
-- 이 마이그레이션이 담는 것:
--   · ALTER store_message_log ADD variables jsonb — 발송 재시도를 자체완결(크론이
--     행만으로 재발송 가능)하게 만드는 페이로드 스냅샷. (0021 은 수정하지 않음)
--   · register_store_shipment(order_id, carrier, tracking_no)  — 운송장 등록/수정(admin)
--       ⤷ 0021 FIX-1 로 store_shipments INSERT 가 RLS 차단됨 → 이 RPC 로만 등록.
--   · enqueue_store_admin_new_order(order_no)                  — 신규주문 admin 알림 큐잉(anon)
--       ⤷ anon 은 order_no 만 넘김. 수신번호·템플릿은 서버가 고정 → 비용폭탄/수신번호
--          조종 차단(은진님 결정). store_message_log 는 RLS 상 anon INSERT 불가라 RPC 필수.
--   · rpc_store_enqueue_reminders()  — 입금기한 24h 전 미입금 리마인드 큐잉(service_role 크론)
--   · rpc_store_expire_orders()      — 기한(72h) 경과 awaiting_payment → expired(service_role 크론)
--       ⤷ 리마인드/만료는 구매자 전화 복호화가 필요 → 앱으로 평문 phone 을 내보내지 않도록
--          DB 내부(SECURITY DEFINER)에서 복호화·큐잉을 끝낸다(발송은 앱 크론이 큐를 flush).
--
-- ── 0021 대비 편차 / 결정 ────────────────────────────────────────────────────
--   D1) store_message_log.variables 컬럼 신설: 0021 스키마엔 없었음. 크론 재발송이
--       주문을 되짚지 않고 행만으로 동일 문자를 재구성하려면 페이로드 스냅샷이 필요.
--       to_phone 은 0021 이 이미 평문 저장하기로 결정한 컬럼이므로 본 편차는 PII
--       노출면을 넓히지 않는다(어드민 전용 테이블). 로그/센트리에는 절대 싣지 않음(앱단 redact).
--   D2) admin 신규주문 알림의 수신번호는 DB 가 알 수 없다(env SOLAPI_ADMIN_PHONE).
--       → enqueue_store_admin_new_order 는 to_phone 에 센티넬 '__admin__' 을 넣고,
--          실제 수신번호 치환은 앱 발송단(sender)이 env 로 수행. anon 이 어떤 번호도
--          주입할 수 없게 하려는 의도(비용폭탄 방지의 핵심).
--   D3) PRD §4 매트릭스의 "주문 접수 → 구매자(order_received)" 발송은 은진님 결정으로
--       P0 에서 제외(구매자 발송은 입금확인 이후). 따라서 본 배치는 order_received 를
--       큐잉하지 않는다. 구매자 계좌/금액 안내는 done 페이지 + 주문조회로 대체.
--
-- 사전조건: 0021/0022 적용 완료 + Vault 'pii_key' 등록(0011). service_role 은 Supabase
--   기본 역할. dev DB 에는 아직 store 마이그레이션 미적용(push 대기) — 본 파일은 계약만 정의.
-- ============================================================================

-- ============================================================================
-- 0. store_message_log 확장 — variables(발송 페이로드 스냅샷)  [편차 D1]
-- ============================================================================
alter table store_message_log
  add column if not exists variables jsonb not null default '{}'::jsonb;

comment on column store_message_log.variables is
  '발송 템플릿 치환 변수 스냅샷(주문번호·금액·기한 등). 크론 재발송이 주문을 되짚지 않고 '
  '행만으로 동일 문자를 재구성하기 위함. PII(전화 원문)는 담지 않음 — 수신번호는 to_phone.';

-- ============================================================================
-- RPC 1) register_store_shipment — 운송장 등록/수정 (어드민 전용, 멱등)
--   · confirm_store_payment 의 role 가드 미러 (super_admin/ops_admin)
--   · store_shipments.order_id unique = 주문당 1건 → 있으면 UPDATE, 없으면 INSERT
--   · 주문 status 는 'paid' → 'shipped' 로만 전이(조건부). paid 아니면 명확한 에러.
--   · store_order_events 감사 기록. jsonb 반환.
-- ============================================================================
create or replace function public.register_store_shipment(
  p_order_id uuid,
  p_carrier text,
  p_tracking_no text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_tracking text;
  v_updated int;
begin
  -- (0) 권한 — confirm_store_payment 와 동일 등급
  if not public.has_admin_role(array['super_admin','ops_admin']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- (1) 입력 검증 (테이블 CHECK 와 이중방어, 한국어 에러 우선)
  if p_carrier is null or p_carrier not in ('cj','lotte','hanjin','logen','post') then
    raise exception 'invalid_carrier' using errcode = 'P0001';
  end if;
  v_tracking := regexp_replace(coalesce(p_tracking_no, ''), '\s', '', 'g');
  if length(v_tracking) = 0 then
    raise exception 'tracking_no_required' using errcode = 'P0001';
  end if;
  if length(v_tracking) > 40 then
    raise exception 'tracking_no_too_long' using errcode = 'P0001';
  end if;

  -- (2) 주문 상태 확인 — paid 인 건만 발송처리(멱등: 이미 shipped 여도 운송장 수정 허용)
  select status into v_status from store_orders where id = p_order_id;
  if v_status is null then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('paid','shipped') then
    -- awaiting_payment/expired/cancelled 등에서 운송장 등록 시도 차단
    raise exception 'order_not_paid' using errcode = 'P0001', detail = 'status=' || v_status;
  end if;

  -- (3) 운송장 upsert — 단일문 ON CONFLICT 로 TOCTOU 레이스 제거(FIX-A).
  --   기존 select→if null→insert/else update 는 동시호출 시 둘 다 null 관측→둘 다 INSERT→
  --   unique_violation(미매핑 에러) 가능. 단일 원자문으로 신규/기존 무관하게 안전.
  --   신규/기존 판별은 하지 않는다 — 이벤트 note 는 아래 status 전이(v_updated)로만 구분한다.
  insert into store_shipments (order_id, carrier, tracking_no)
  values (p_order_id, p_carrier, v_tracking)
  on conflict (order_id) do update
    set carrier = excluded.carrier,
        tracking_no = excluded.tracking_no,
        shipped_at = now();

  -- (4) 상태 전이 paid → shipped (조건부 · 멱등). 이미 shipped 면 0행(정상).
  update store_orders
     set status = 'shipped'
   where id = p_order_id and status = 'paid';
  get diagnostics v_updated = row_count;

  -- (5) 감사 이벤트 — 최초 발송 전이일 때만 상태변경 이벤트, 운송장 수정만이면 note 구분
  if v_updated > 0 then
    insert into store_order_events (order_id, from_status, to_status, actor, note)
    values (p_order_id, 'paid', 'shipped', coalesce(auth.uid()::text, 'system'), 'shipment_registered');
  else
    insert into store_order_events (order_id, from_status, to_status, actor, note)
    values (p_order_id, v_status, v_status, coalesce(auth.uid()::text, 'system'), 'shipment_updated');
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', 'shipped',
    'carrier', p_carrier,
    'tracking_no', v_tracking,
    'transitioned', v_updated > 0
  );
end;
$$;

revoke all on function public.register_store_shipment(uuid, text, text) from public, anon;
grant execute on function public.register_store_shipment(uuid, text, text) to authenticated;

-- ============================================================================
-- RPC 2) enqueue_store_admin_new_order — 신규주문 admin 알림 큐잉 (anon 호출)  [편차 D2]
--   · anon 은 order_no 만 넘긴다 — 수신번호/템플릿은 서버가 고정(비용폭탄 방지).
--   · to_phone = 센티넬 '__admin__' (앱 sender 가 env SOLAPI_ADMIN_PHONE 로 치환).
--   · dedupe_key 'admin_new_order:{order_id}' unique → 중복 큐잉 시 no-op(멱등).
--   · variables 는 주문에서 서버가 구성(주문번호·주문자명·뒷4·총액·품목요약). PII 원문 없음.
--   · 존재하지 않는 order_no 는 조용히 no-op(열거 힌트 최소화, best-effort 트리거).
--   · [의도적 수용] order_no 존재여부에 따른 타이밍 사이드채널: order_no 만으로는 PII 복호화도
--     비용폭탄(수신번호 조종)도 불가하고, admin 알림은 order 당 dedupe 로 1회 상한이라 수용.
--     (edge rate-limit 은 R5 하드닝 트래킹)
-- ============================================================================
create or replace function public.enqueue_store_admin_new_order(
  p_order_no text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order store_orders%rowtype;
  v_items text;
  v_item_count int;
  v_vars jsonb;
begin
  -- 응답은 존재/미존재를 구분하지 않는다(열거 오라클 최소화). 호출은 best-effort.
  if p_order_no is null then
    return jsonb_build_object('ok', true);
  end if;

  select * into v_order from store_orders where order_no = trim(p_order_no);
  if not found then
    return jsonb_build_object('ok', true);
  end if;

  -- 품목 요약 (상품명 x수량, 상위 몇 개) — admin 알림 가독성용, PII 아님
  select string_agg(p.name || ' ' || i.qty || '개', ', ' order by i.id), count(*)
    into v_items, v_item_count
    from store_order_items i
    join store_variants v on v.id = i.variant_id
    join store_products p on p.id = v.product_id
   where i.order_id = v_order.id;

  v_vars := jsonb_build_object(
    'order_no', v_order.order_no,
    'buyer_name', v_order.buyer_name,
    'phone_tail4', v_order.buyer_phone_tail4,
    'total_amount', v_order.total_amount,
    'item_count', coalesce(v_item_count, 0),
    'items_summary', coalesce(v_items, '')
  );

  -- 멱등 삽입 — dedupe_key 충돌이면 아무 것도 안 함
  insert into store_message_log (dedupe_key, order_id, template, to_phone, variables, status)
  values ('admin_new_order:' || v_order.id, v_order.id, 'new_order_admin', '__admin__', v_vars, 'pending')
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enqueue_store_admin_new_order(text) from public;
grant execute on function public.enqueue_store_admin_new_order(text) to anon, authenticated;

-- ============================================================================
-- RPC 3) rpc_store_enqueue_reminders — 입금기한 24h 전 미입금 리마인드 큐잉
--   실행 주체: service_role 크론. (구매자 전화 복호화가 필요하므로 DB 내부에서 완결)
--   멱등: reminder_sent_at 마커 + dedupe_key unique 이중.
--     · CTE 로 대상 주문의 reminder_sent_at 을 원자적으로 now() 로 flip(중복 스캔 차단),
--       flip 된 행에 대해서만 message_log 삽입(on conflict do nothing).
--   variables: 주문번호·금액·기한(ISO). 계좌/브랜드 등 정적정보는 앱 sender 가 병합.
-- ============================================================================
create or replace function public.rpc_store_enqueue_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.pii_key();
  v_count int;
begin
  with due as (
    update store_orders o
       set reminder_sent_at = now()
     where o.status = 'awaiting_payment'
       and o.reminder_sent_at is null
       and o.expires_at > now()
       and o.expires_at <= now() + interval '24 hours'
    returning o.id, o.order_no, o.total_amount, o.expires_at, o.buyer_phone_encrypted
  ), ins as (
    insert into store_message_log (dedupe_key, order_id, template, to_phone, variables, status)
    select
      'payment_reminder:' || d.id,
      d.id,
      'payment_reminder',
      regexp_replace(extensions.pgp_sym_decrypt(d.buyer_phone_encrypted, v_key), '\D', '', 'g'),
      jsonb_build_object(
        'order_no', d.order_no,
        'total_amount', d.total_amount,
        'expires_at', d.expires_at
      ),
      'pending'
    from due d
    on conflict (dedupe_key) do nothing
    returning 1
  ), aud as (
    -- FIX-B: buyer_phone 복호화 발생 → V1 규약(0011)대로 PII 접근 감사로그 필수.
    --   actor_type 'system'/actor_id null 은 0001 시스템 이벤트 패턴. 데이터수정 CTE 라
    --   메인쿼리가 참조하지 않아도 항상 실행됨(Postgres WITH 규약).
    insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
    select 'system', 'pii.store_buyer_phone_decrypted', 'store_order', d.id,
           jsonb_build_object('reason', 'payment_reminder')
    from due d
    returning 1
  )
  select count(*) into v_count from ins;

  return jsonb_build_object('ok', true, 'enqueued', coalesce(v_count, 0));
end;
$$;

revoke all on function public.rpc_store_enqueue_reminders() from public, anon, authenticated;
grant execute on function public.rpc_store_enqueue_reminders() to service_role;

-- ============================================================================
-- RPC 4) rpc_store_expire_orders — 기한(72h) 경과 awaiting_payment → expired
--   실행 주체: service_role 크론. 재고 미차감이므로 복원 불필요(PRD §4).
--   멱등: status 조건부 UPDATE — 이미 expired/paid 는 대상 아님. 재실행해도 0행.
-- ============================================================================
create or replace function public.rpc_store_expire_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update store_orders o
       set status = 'expired'
     where o.status = 'awaiting_payment'
       and o.expires_at <= now()
    returning o.id
  ), ev as (
    insert into store_order_events (order_id, from_status, to_status, actor, note)
    select e.id, 'awaiting_payment', 'expired', 'system', 'expired_by_cron'
    from expired e
    returning 1
  )
  select count(*) into v_count from ev;

  return jsonb_build_object('ok', true, 'expired', coalesce(v_count, 0));
end;
$$;

revoke all on function public.rpc_store_expire_orders() from public, anon, authenticated;
grant execute on function public.rpc_store_expire_orders() to service_role;
