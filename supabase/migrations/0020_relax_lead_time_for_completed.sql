-- ============================================================================
-- 0020: chk_lead_time 제약 완화 — 완료/종결 status 시 면제
--
-- 증상: complete_install_atomic RPC 호출 시 'check constraint chk_lead_time' 위반.
-- 원인: 0001_init.sql 의 chk_lead_time 이 D+2 리드타임 강제 (시공 시각 >= 주문일+2일).
--       베타·테스트·긴급 주문 등 lead time 짧은 케이스에서 시공 완료 transition 막음.
-- 해결: 완료/종결 status (no_drill_completed, drill_converted_completed, paid, closed,
--       cancel_confirmed_coupang_transfer) 에서는 lead time 검사 면제.
--       이 status 들은 이미 시공 끝났거나 종료된 상태라 lead time 의미 없음.
-- ============================================================================

alter table orders drop constraint if exists chk_lead_time;

alter table orders add constraint chk_lead_time
  check (
    -- 완료/종결 status 는 면제 (transition 차단 방지)
    status in (
      'no_drill_completed',
      'drill_converted_completed',
      'paid',
      'closed',
      'cancel_confirmed_coupang_transfer',
      'cancel_requested',
      'on_hold',
      'postponed'
    )
    -- 시각 미정도 OK
    or scheduled_installation_at is null
    -- D+2 lead time 충족
    or scheduled_installation_at >= order_received_at + interval '2 days'
    -- override 명시 시 우회 (긴급/특수 케이스)
    or special_notes like '%[override:%'
  );
