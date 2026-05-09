-- ============================================================================
-- 0019: v_customer_for_technician security_invoker 수정
--
-- 증상: driver /today 빈 상태 (캘린더는 보임).
-- 원인: 0006_security_fix.sql 에서 v_customer_for_technician 을 security_invoker=true 로 set.
--       view 내부 EXISTS 조건이 본인 주문의 customer 만 노출하게 설계됐는데,
--       invoker 모드라 customers 테이블 RLS 도 추가 적용 → driver 는 customers select 권한 없어
--       모든 row 가 차단됨.
-- 해결: security_invoker=false (definer 모드) — view 의 EXISTS 조건이 RLS 역할 수행.
--       view definer (postgres) 권한으로 customers 직접 read 가능.
--       EXISTS 조건의 public.technician_id() 는 caller 의 JWT 클레임 그대로 평가됨 (stable 함수).
-- ============================================================================

alter view public.v_customer_for_technician set (security_invoker = false);

comment on view public.v_customer_for_technician is
  '기사 전용 고객 뷰. customers 직접 접근 금지 — 이 뷰만 조회. EXISTS 조건이 본인 주문 customer 만 노출 (0019: definer 모드).';
