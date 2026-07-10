-- ============================================================================
-- 0025_installation_jobs.sql — P1 전용 시공(installation) 테이블 + 시트 동기화 재연결
-- Source of truth: 03_PRD_P1_FSM_SHEETS.md · 은진님 실제 구글시트 양식(A~M 13열)
--
-- 이 마이그레이션이 담는 것:
--   · installation_jobs  — 은진님 본사(자가) 시공건. 구글시트 A~M 13열을 그대로 담는 전용 테이블.
--   · 0024 side-table FK 재연결 — sheet_row_map.entity_id / sync_outbox.entity_id 를
--     orders(id) → installation_jobs(id) 로 변경(entity='installation' 이 이제 이 테이블을 가리킴).
--
-- ── 왜 orders 가 아니라 새 테이블인가 ────────────────────────────────────────
--   0024 는 동기화 대상 엔티티를 orders 로 잡았으나, orders 는 쿠팡 파일럿 형태다
--   (coupang_order_id/option/price NOT NULL · 18종 쿠팡 status enum). 은진님이 본인 회사
--   시공을 시트에 적는 방식(성함/연락처/주소/방문시간/설치내용…)은 구조적으로 orders 에
--   들어갈 수 없다. 그래서 은진님 시트 양식(A~M)을 1:1로 담는 전용 테이블을 만들고
--   동기화를 이 테이블로 재연결한다. orders(쿠팡)는 건드리지 않는다.
--
--   ⚠ 이름 주의: 0001 에 이미 `installations` 테이블이 있다(주문 실행기록 — 도착/시작/완료
--   타임스탬프, order_id FK). 그것과 충돌하지 않도록 본 테이블명은 `installation_jobs` 로 둔다.
--   동기화 엔티티 라벨은 여전히 'installation'(도메인 라벨) → 앱 어댑터가 installation_jobs 로 해석.
--
-- ── 평문(PLAINTEXT) PII 결정 (의도적 · 리뷰어 확인요망) ──────────────────────────
--   installation_jobs 의 고객 성함/연락처/주소는 암호화하지 않고 평문으로 저장한다. 근거:
--     (1) 이 데이터는 이미 은진님 구글시트에 평문으로 존재한다(본 테이블은 그 거울).
--     (2) 시트 양방향 왕복은 평문이라야 성립한다 — 암호화하면 라운드트립(에코 정합)이 깨진다.
--     (3) orders 계열의 암호화 PII 프로비저닝(고객 레코드 생성) 요구가 시트→앱 CREATE 를
--         막았는데, 평문 전용 테이블은 그 병목을 제거한다(은진님 1차 워크플로: 시트에 먼저 기록).
--   보상통제: 접근을 admin(super_admin/ops_admin) + 감사(auditor) 로만 제한(아래 RLS). 공개면/
--   기사앱/쿠팡CS 외 노출 없음. 동기화 워커/웹훅은 service_role(RLS 우회)로만 접근.
--
-- ── 금지선 (§2.4) ────────────────────────────────────────────────────────────
--   동기화는 시공 데이터를 삭제하지 않는다. 시트 행 삭제 → sheet_row_map.archived_at 마킹(보관)만.
--   FK on delete restrict 로 installation_jobs 하드삭제도 side-table 가 있으면 차단.
--
-- 사전조건: 0001~0024 적용 완료(이 브랜치는 dev DB push 대기 — 0024·0025 함께 push 예정).
-- ============================================================================

-- ============================================================================
-- 1. installation_jobs — 은진님 본사(자가) 시공건 (시트 A~M 1:1)
-- ============================================================================
create table installation_jobs (
  id uuid primary key default gen_random_uuid(),

  -- 시트 A~M (은진님 양식 그대로) ─────────────────────────────────────────────
  scheduled_install_date date,                   -- A 시공일자
  received_date          date,                   -- B 접수일자
  move_date              date,                   -- C 이사일자
  visit_time             text,                   -- D 방문시간 (자유서식: "오전"/"14:00" 등 원문 보존)
  technician_name        text,                   -- E 담당자 (시트 원문 이름 — 평문 미러)
  technician_id          uuid references technicians(id) on delete set null, -- 선택: 후속 이름→기사 연결용
  customer_phone         text,                   -- F 연락처
  customer_phone2        text,                   -- G 연락처2
  address                text,                   -- H 주소
  address_detail         text,                   -- I 상세주소
  customer_name          text,                   -- J 성함
  install_type           text,                   -- K 타입
  install_content        text,                   -- L 설치내용
  special_notes          text,                   -- M 특이사항

  -- 앱 내부 상태(시트 미동기화 — 기사/운영이 앱에서 관리) ─────────────────────────
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table installation_jobs is
  '은진님 본사(자가) 시공건 — 구글시트 A~M 13열을 담는 전용 테이블(orders=쿠팡과 분리). '
  '고객 PII 평문 저장(시트 미러 · 왕복 정합) · admin/auditor 만 접근(RLS). '
  'status 는 앱 내부 상태로 시트 동기화 대상이 아니다.';
comment on column installation_jobs.visit_time is
  'D 방문시간 — 자유서식 텍스트("오전"/"14:00" 등). 시트 원문을 그대로 보존(파싱하지 않음).';
comment on column installation_jobs.technician_name is
  'E 담당자 — 시트 원문 이름(평문). technician_id 로 실제 기사 레코드와 후속 연결(선택).';
comment on column installation_jobs.status is
  '앱 내부 시공 상태(scheduled/in_progress/completed/cancelled). 기사/운영이 앱에서 관리 · 시트 미동기화.';

-- 기사 오늘일정(시공일자순) · 상태 필터
create index idx_installation_jobs_schedule on installation_jobs(scheduled_install_date);
create index idx_installation_jobs_status   on installation_jobs(status);

-- ============================================================================
-- 2. RLS — admin(super_admin/ops_admin) 관리 + auditor 읽기. 워커/웹훅은 service_role(우회).
-- ============================================================================
--   JWT/role helper 는 0002_rls.sql: has_admin_role() / admin_role().
--   평문 PII 이므로 접근면을 좁게 유지(공개면/기사앱 노출 없음). 동기화는 service_role(BYPASSRLS).
alter table installation_jobs enable row level security;

create policy installation_jobs_admin_all on installation_jobs for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));

create policy installation_jobs_auditor_read on installation_jobs for select
  using (public.admin_role() = 'auditor');

-- ============================================================================
-- 3. updated_at 자동 갱신 트리거 (set_updated_at 은 0001 정의)
-- ============================================================================
create trigger trg_installation_jobs_updated
  before update on installation_jobs for each row execute function set_updated_at();

-- ============================================================================
-- 4. 0024 ↔ installation_jobs FK 재연결
-- ============================================================================
--   0024 는 sheet_row_map.entity_id / sync_outbox.entity_id 를 orders(id) 로 FK 걸었다
--   (당시 동기화 대상=orders). 이제 entity='installation' 이 installation_jobs 를 가리키므로
--   두 side-table 의 FK 대상을 installation_jobs(id) 로 바꾼다.
--
--   왜 0024 를 직접 수정하지 않고 여기서 ALTER 하는가(마이그레이션 순서 제약):
--     installation_jobs 는 0025 에서 태어난다. 0024 는 0025 보다 먼저 실행되므로, 0024 시점엔
--     아직 installation_jobs 가 없어 0024 의 인라인 FK 를 installation_jobs 로 지정할 수 없다.
--     따라서 0024 는 그대로 두고(리뷰 완료 상태 보존), 테이블을 만든 직후 이 위치에서 FK 를
--     교체한다. 별도 0026 fixup 이 아니라 "테이블을 만든 바로 그 마이그레이션"에서 정리하므로
--     응집도가 높고, 아직 어떤 DB 에도 push 되지 않아 데이터 마이그레이션 이슈도 없다.
--   entity CHECK('installation') 은 0024 그대로 유지(라벨 불변).
alter table sheet_row_map drop constraint if exists sheet_row_map_entity_id_fkey;
alter table sheet_row_map
  add constraint sheet_row_map_entity_id_fkey
  foreign key (entity_id) references installation_jobs(id) on delete restrict;

alter table sync_outbox drop constraint if exists sync_outbox_entity_id_fkey;
alter table sync_outbox
  add constraint sync_outbox_entity_id_fkey
  foreign key (entity_id) references installation_jobs(id) on delete restrict;
