-- ============================================================================
-- 0018: v_technician_today RLS 통과 fix
--
-- 증상: driver /today 화면에서 본인 배차 주문이 안 보임 (캘린더엔 보임).
-- 원인: v_technician_today 가 customers 테이블을 직접 join 하고 security_invoker=true
--       (0006_security_fix.sql) — driver 는 customers select 권한 없어 join 결과 0.
-- 해결: customers join → v_customer_for_technician join (이미 RLS 통과 view).
--       추가로 v2 정책: 사전통화 outcome 무관 (CONTEXT.md: 시도 행위가 곧 ✓).
-- ============================================================================

create or replace view public.v_technician_today as
select
  o.id as order_id,
  o.assigned_technician_id,
  o.scheduled_installation_at,
  o.status,
  c.phone_tail4,
  coalesce(c.address_region_sido, '') || ' ' || coalesce(c.address_region_sigungu, '') as region,
  coalesce(o.tv_brand, '') || ' ' || coalesce(o.tv_model, '') as tv,
  exists (
    select 1 from public.call_logs cl
    where cl.order_id = o.id
      and cl.type = 'pre_arrival_30min'
    -- v2: outcome 무관 (시도 행위 = 사전통화 ✓)
  ) as pre_call_done,
  (select count(*) from public.photos p where p.order_id = o.id) as photo_count
from public.orders o
join public.v_customer_for_technician c on c.id = o.customer_id
where o.scheduled_installation_at::date = current_date
  and o.status in ('assigned','en_route','on_site','in_progress');

comment on view public.v_technician_today is
  'driver /today 페이지 — 본인 배차 오늘 시공건. v_customer_for_technician join 으로 RLS 통과 (0018).';
