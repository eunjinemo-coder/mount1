-- ============================================================================
-- 0007_security_round2.sql — 2차 중간점검 P1 보강
-- Source: 2차 보안 에이전트 보고서 (P1-NEW-2 + P0-NEW-1 후속)
-- 변경: technicians 테이블 cs_admin·ops_admin·auditor read 정책 추가
--       cancellation_reports 의 기사 self-insert 가 의도대로 동작하는지 확인
-- ============================================================================

-- ============================================================================
-- P1-NEW-2: technicians 조회 정책 보강
--   기존: technicians_select_self (본인) + technicians_admin_all (super_admin·dispatch_admin)
--   누락: cs_admin·ops_admin·auditor 의 read 권한 → 빈 목록 반환되어 운영 불가
-- ============================================================================

-- cs_admin·ops_admin: 운영용 read (전체 컬럼) · 멱등성 보장
drop policy if exists technicians_select_ops on technicians;
create policy technicians_select_ops on technicians for select
  using (public.has_admin_role(array['cs_admin', 'ops_admin']));

-- auditor: 감사용 read (전체 컬럼 — phone 도 포함되나 클라 마스킹)
-- 컬럼 수준 제어는 PostgreSQL 자체 미지원, 클라이언트(admin/technicians page)에서 phoneMasked 처리.
drop policy if exists technicians_select_auditor on technicians;
create policy technicians_select_auditor on technicians for select
  using (public.admin_role() = 'auditor');

-- ============================================================================
-- P0-NEW-1 follow-up: cancellation_reports 의 기사 직접 insert 활성화
--   기존 RLS 정책 cancel_insert_technician 은 technician_id = public.technician_id() 요구.
--   현재 cancel/actions.ts 는 stub UUID 로 insert 시도해 RLS 거절.
--   해결: technician_id 컬럼을 default public.technician_id() 로 자동 채움 + 기사 본인은 명시 불필요.
--
--   하지만 default 함수 호출이 RLS check 에서 인정되지 않을 수 있음.
--   안전책: client-side 에서 session.technicianId 를 먼저 받아 insert 시 동봉.
--   (SQL 변경은 최소화, 코드 측 수정으로 처리 — 별도 작업)
-- ============================================================================

-- 본 마이그레이션은 추가 정책 2건만 적용. cancel insert 는 코드 측에서 session 사용.
