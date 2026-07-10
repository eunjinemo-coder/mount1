-- ============================================================================
-- 0024_sheets_sync.sql — P1 구글시트 양방향 동기화 (스키마 · 인덱스 · RLS)
-- Source of truth: 03_PRD_P1_FSM_SHEETS.md §2.2(행식별/에코/충돌/멱등) · §2.3(스키마)
--                  · §2.4(실패처리/금지선) · §2.5(설정절차)
--
-- 이 마이그레이션이 담는 것:
--   · sheet_links      — 어떤 시트의 어떤 탭이 어떤 엔티티와 연결되는가 + 열 매핑(은진님 양식 그대로)
--   · sync_outbox      — 앱→시트 대기열 (트랜잭션 밖 유실방지 · 워커가 upsert)
--   · sheet_row_map    — 행 식별 side table (_sync_id ↔ entity_id · last_synced_hash · 보관표시)
--   · sheet_inbox_dedup— 시트→앱 멱등 (sheet_id,_sync_id,content_hash) unique
--   · sync_log         — 전 방향 감사 + 충돌 기록
--
-- ── 동기화 엔티티 결정 (실 스키마 조사 결과) ──────────────────────────────────
--   PRD §2.3 은 entity 기본값을 'installation' 로 두지만, V1(MOUNT1) 실 스키마에서
--   은진님이 시트로 관리하는 "시공건"의 일정·상태·고객·기사 데이터는 `installations`
--   테이블이 아니라 `orders` 테이블에 있다(scheduled_installation_at · status(18종) ·
--   customer_id · assigned_technician_id · tv_* · requested_install_date · special_notes).
--   `installations` 는 실행기록(도착/시작/완료 타임스탬프)일 뿐 일정면이 아니다.
--   따라서 동기화 대상 엔티티 = orders 이며, entity 문자열 'installation' 은 이 orders
--   행(=시공건)을 가리키는 도메인 라벨로 사용한다(앱 어댑터가 orders 로 해석).
--   → 핵심 테이블(orders)에 컬럼을 붙이지 않고 sheet_row_map side table 로 추적한다
--     (PRD 권고 "prefer a side table"). _sync_id/last_synced_hash 는 orders 를 건드리지 않음.
--
-- ── org_id ──────────────────────────────────────────────────────────────────
--   PRD §2.3 은 sheet_links.org_id not null 이지만 이 브랜치엔 org 테이블이 아직 없다
--   (P2 멀티테넌트 선행작업). nullable 로 두고 P2 에서 not null 승격 예정.
--
-- ── 금지선 (§2.4) ────────────────────────────────────────────────────────────
--   동기화는 시공 데이터를 삭제하지 않는다. 시트 행 삭제 → sheet_row_map.archived_at
--   마킹(보관)만. 어떤 경로도 orders 하드삭제를 하지 않는다.
--
-- ── 워커/웹훅 접근 ────────────────────────────────────────────────────────────
--   앱→시트 워커·시트→앱 웹훅은 service_role(getAdminClient)로 동작 → RLS 우회.
--   아래 RLS 는 admin UI(super_admin/dispatch_admin: 시공 운영주체) + auditor 읽기용.
--   JWT/role helper 는 0002_rls.sql: has_admin_role() / admin_role().
--
-- 사전조건: 0001~0023 적용 완료. 이 파일은 계약만 정의(dev DB push 는 은진님 승인 후).
-- ============================================================================

-- ============================================================================
-- 1. sheet_links — 시트 연결 + 열 매핑
-- ============================================================================
create table sheet_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,                                   -- P2 멀티테넌트(현재 nullable · 본사=조직#1)
  spreadsheet_id text not null,                  -- 구글시트 문서 ID(URL 의 /d/<ID>/)
  sheet_name text not null,                      -- 탭 이름(gid 아님 · Apps Script sheet.getName())
  entity text not null default 'installation'    -- 도메인 라벨(앱 어댑터가 orders 로 해석)
    check (entity in ('installation')),          -- db#5: 현재 지원 엔티티 화이트리스트(오타/미지원 차단)
  column_map jsonb not null,                     -- {"B":"scheduled_date","C":"status",...} 시트 열↔앱 필드
  sync_id_column text not null default 'AI',     -- _sync_id 숨김열(시트 열문자). 행 식별 기준. 데이터열('A'=시공일자 등) 회피 위해 기본 'AI'(빈 열).
  header_row int not null default 1 check (header_row >= 1),
  active boolean not null default true,
  last_polled_at timestamptz,                    -- 폴링 백업(5분) 마지막 스냅샷 시각
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_name)
);

comment on table sheet_links is
  '시트↔엔티티 연결. column_map=은진님 현재 양식 그대로 매핑(시트 양식을 바꾸지 않는다). '
  'entity=시공건 도메인 라벨(앱 어댑터가 orders 로 해석). active=false 면 양방향 동기화 중단.';
comment on column sheet_links.column_map is
  '시트 열문자(A/B/…)→앱 필드명 매핑. 예 {"B":"scheduled_date","C":"status","D":"phone_tail4"}. '
  '_sync_id 열은 sync_id_column 으로 별도 지정(매핑 대상 아님).';

-- D2: 실제 쿼리(activeLinksForEntity: entity=? AND active) 기준 — entity 선두 부분인덱스.
create index idx_sheet_links_active on sheet_links(entity) where active;

-- ============================================================================
-- 2. sync_outbox — 앱→시트 대기열
-- ============================================================================
create table sync_outbox (
  id bigint generated always as identity primary key,
  link_id uuid not null references sheet_links(id) on delete cascade,
  -- D1: orders FK(on delete restrict) — 고아 outbox 방지 + "orders 하드삭제 금지선" DB 강제.
  entity_id uuid not null references orders(id) on delete restrict,  -- orders.id (시공건)
  content_hash text not null,                    -- enqueue 시점 매핑필드 스냅샷 해시(감사/coalesce)
  -- C2: processing = 크론이 원자적 claim(SKIP LOCKED)으로 선점한 상태. 중첩실행 이중처리 차단.
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts int not null default 0,
  claimed_at timestamptz,                         -- claim 시각(스테일 processing 재확보 기준)
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table sync_outbox is
  '앱→시트 발송 대기열. server action 성공 후 enqueue(트랜잭션 밖 유실방지). '
  '워커가 rpc_claim_sheet_outbox 로 원자적 claim(processing) 후 시트 upsert. 행단위 upsert 로 재실행 안전.';

-- 워커 claim 폴링(가장 오래된 pending/failed 우선) + 스테일 processing 재확보
create index idx_sync_outbox_poll on sync_outbox(created_at)
  where status in ('pending','failed','processing');
create index idx_sync_outbox_entity on sync_outbox(link_id, entity_id);

-- ============================================================================
-- 3. sheet_row_map — 행 식별 side table (§2.2 핵심)
-- ============================================================================
--   행 순서·행번호에 절대 의존하지 않는다. _sync_id(UUID) 만으로 정합.
--   앱이 만든 행 → 앱이 sync_row_id 발급, 시트 신규행 → 웹훅/폴링이 발급.
--   last_synced_hash = 마지막으로 양방향 합의된 매핑필드 해시(에코루프 차단 기준).
--   archived_at 마킹 = 시트 행 삭제 대응(보관). 하드삭제 금지선(§2.4).
create table sheet_row_map (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references sheet_links(id) on delete cascade,
  entity text not null default 'installation'
    check (entity in ('installation')),          -- db#5: 엔티티 화이트리스트
  -- D1: orders FK(on delete restrict) — 고아 행매핑 방지 + orders 하드삭제 금지선 DB 강제.
  entity_id uuid not null references orders(id) on delete restrict,  -- orders.id
  sync_row_id uuid not null default gen_random_uuid(),  -- 시트 _sync_id 숨김열 값
  last_synced_hash text,                         -- 마지막 합의 해시(에코루프 no-op 기준)
  archived_at timestamptz,                       -- 시트 행 삭제 → 보관(삭제 아님)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, entity_id),                   -- 링크당 엔티티 1행
  unique (link_id, sync_row_id)                  -- 링크당 _sync_id 유일(행 식별)
);

comment on table sheet_row_map is
  '행 식별 side table. sync_row_id=시트 _sync_id 숨김열 ↔ entity_id=orders.id 매핑. '
  'last_synced_hash 로 에코루프 no-op 판정. archived_at 로 시트행삭제→보관(하드삭제 금지).';

create index idx_sheet_row_map_active on sheet_row_map(link_id, entity_id)
  where archived_at is null;

-- ============================================================================
-- 4. sheet_inbox_dedup — 시트→앱 멱등 (§2.2)
-- ============================================================================
--   같은 변경(같은 _sync_id + 같은 content_hash) 중복 수신해도 1회 처리.
--   웹훅과 폴링이 같은 편집을 이중 전달해도 unique 충돌 → skipped_noop.
create table sheet_inbox_dedup (
  id bigint generated always as identity primary key,
  link_id uuid not null references sheet_links(id) on delete cascade,
  sync_row_id uuid not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (link_id, sync_row_id, content_hash)
);

comment on table sheet_inbox_dedup is
  '시트→앱 멱등 키 (link_id, sync_row_id, content_hash). 웹훅/폴링 이중수신 시 unique 충돌로 1회만 처리.';

create index idx_sheet_inbox_dedup_gc on sheet_inbox_dedup(created_at);  -- 오래된 키 GC 용

-- ============================================================================
-- 5. sync_log — 전 방향 감사 + 충돌 기록 (§2.4 운영가시성)
-- ============================================================================
create table sync_log (
  id bigint generated always as identity primary key,
  link_id uuid references sheet_links(id) on delete set null,
  direction text not null check (direction in ('app_to_sheet','sheet_to_app')),
  entity_id uuid,
  result text not null check (result in ('ok','skipped_noop','conflict_sheet_won','conflict_app_won','error')),
  detail jsonb,
  created_at timestamptz not null default now()
);

comment on table sync_log is
  '동기화 감사로그. result=ok/skipped_noop(에코·멱등)/conflict_*(LWW)/error(형식오류 등). '
  'admin 상태위젯이 방향별 최근 N건을 읽는다.';

create index idx_sync_log_recent on sync_log(created_at desc);
create index idx_sync_log_link_dir on sync_log(link_id, direction, created_at desc);

-- ============================================================================
-- 6. RLS — admin(시공 운영주체) 관리 + auditor 읽기. 워커/웹훅은 service_role(우회).
-- ============================================================================
--   시공 운영주체 = super_admin(대표) + dispatch_admin(배차/일정). auditor 읽기.
--   (주문 일정을 다루는 테이블이므로 orders 운영역할 모델과 정합 — 0002 참조)
alter table sheet_links       enable row level security;
alter table sync_outbox       enable row level security;
alter table sheet_row_map     enable row level security;
alter table sheet_inbox_dedup enable row level security;
alter table sync_log          enable row level security;

-- sheet_links — 연결 설정 CRUD(super/dispatch), auditor 읽기
create policy sheet_links_admin_all on sheet_links for all
  using (public.has_admin_role(array['super_admin','dispatch_admin']))
  with check (public.has_admin_role(array['super_admin','dispatch_admin']));
create policy sheet_links_auditor_read on sheet_links for select
  using (public.admin_role() = 'auditor');

-- sync_outbox — admin 읽기 + 재시도(UPDATE). INSERT/DELETE 는 service_role 워커/enqueue 전용.
create policy sync_outbox_admin_read on sync_outbox for select
  using (public.has_admin_role(array['super_admin','dispatch_admin']) or public.admin_role() = 'auditor');
create policy sync_outbox_admin_update on sync_outbox for update
  using (public.has_admin_role(array['super_admin','dispatch_admin']))
  with check (public.has_admin_role(array['super_admin','dispatch_admin']));

-- sheet_row_map — admin/auditor 읽기전용(행 식별은 워커/웹훅 service_role 만 씀)
create policy sheet_row_map_admin_read on sheet_row_map for select
  using (public.has_admin_role(array['super_admin','dispatch_admin']) or public.admin_role() = 'auditor');

-- sheet_inbox_dedup — admin/auditor 읽기전용(운영 진단용)
create policy sheet_inbox_dedup_admin_read on sheet_inbox_dedup for select
  using (public.has_admin_role(array['super_admin','dispatch_admin']) or public.admin_role() = 'auditor');

-- sync_log — admin/auditor 읽기전용(감사면). 쓰기는 service_role 만.
create policy sync_log_admin_read on sync_log for select
  using (public.has_admin_role(array['super_admin','dispatch_admin']) or public.admin_role() = 'auditor');

-- ============================================================================
-- 7. updated_at 자동 갱신 트리거 (set_updated_at 은 0001 정의)
-- ============================================================================
create trigger trg_sheet_links_updated   before update on sheet_links   for each row execute function set_updated_at();
create trigger trg_sync_outbox_updated    before update on sync_outbox    for each row execute function set_updated_at();
create trigger trg_sheet_row_map_updated  before update on sheet_row_map  for each row execute function set_updated_at();

-- ============================================================================
-- 8. 워커 RPC — 원자적 claim / 행식별 확정 / 실패기록 (C2 리뷰: 크론 중첩 이중처리·중복행 차단)
--   service_role 워커 전용. SECURITY DEFINER + search_path 고정. public revoke.
-- ============================================================================

-- (a) rpc_claim_sheet_outbox — pending/failed(attempts<3) + 스테일 processing(5분) 을 원자적으로
--     'processing' 선점(FOR UPDATE SKIP LOCKED). 두 크론이 겹쳐도 같은 행을 이중 처리하지 않는다.
--
--   G1(엔티티당 in-flight 직렬화): 같은 (link,entity)로 이미 processing 중인 다른 행이 있으면
--     이번 claim 에서 제외한다. Sheets append 는 프로세스 락이 없어, 같은 시공건의 outbox 2건이
--     서로 다른 크론에 잡히면 같은 sync_row_id 로 이중 append(중복 행)가 날 수 있다 → 엔티티당
--     동시 처리 1건으로 직렬화(같은 건은 앞 건이 done/failed 로 끝난 뒤 다음 틱에 순차 처리).
--   G2(poison-loop 바운드): 스테일 processing 재확보 시에만 attempts 를 +1 한다. 플랫폼 크래시로
--     markFailed(rpc_fail)가 도달 못해도 재확보가 무한 반복되지 않게(3회 후 attempts<3 조건서 탈락).
--     정상 pending/failed claim 은 attempts 를 소모하지 않는다(SET 의 old-row status 로 분기).
create or replace function public.rpc_claim_sheet_outbox(p_limit int default 100)
returns setof sync_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update sync_outbox o
     set status = 'processing',
         claimed_at = now(),
         updated_at = now(),
         -- G2: old-row status 기준 — 스테일 processing 재확보만 +1(정상 경로는 미소모).
         attempts = case when o.status = 'processing' then o.attempts + 1 else o.attempts end
   where o.id in (
     select s.id from sync_outbox s
      where (
              (s.status in ('pending','failed') and s.attempts < 3)
           or (s.status = 'processing' and s.claimed_at < now() - interval '5 minutes' and s.attempts < 3)
            )
        -- G1: 같은 (link,entity)로 in-flight(최근 5분 내 processing)인 다른 행이 있으면 제외.
        and not exists (
          select 1 from sync_outbox p
           where p.link_id = s.link_id
             and p.entity_id = s.entity_id
             and p.id <> s.id
             and p.status = 'processing'
             and p.claimed_at >= now() - interval '5 minutes'
        )
      order by s.created_at
      for update skip locked
      limit greatest(1, least(p_limit, 500))
   )
  returning o.*;
end;
$$;

-- (b) rpc_ensure_sheet_row_map — (link,entity) 행매핑을 get-or-create 하고 sync_row_id 반환.
--     C2 핵심: 최초 동기화 시 두 실행이 같은 sync_row_id 를 보게 만들어 시트 중복 append 차단.
create or replace function public.rpc_ensure_sheet_row_map(p_link_id uuid, p_entity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into sheet_row_map (link_id, entity_id)
  values (p_link_id, p_entity_id)
  on conflict (link_id, entity_id) do nothing;

  select sync_row_id into v_id
    from sheet_row_map
   where link_id = p_link_id and entity_id = p_entity_id;
  return v_id;
end;
$$;

-- (c) rpc_fail_sheet_outbox — attempts 원자적 증가(read→write 경합 제거).
create or replace function public.rpc_fail_sheet_outbox(p_id bigint, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sync_outbox
     set status = 'failed', attempts = attempts + 1,
         last_error = left(coalesce(p_error, ''), 500), updated_at = now()
   where id = p_id;
end;
$$;

-- (d) rpc_gc_sheets_sync — GC: 오래된 dedup 키 · sync_log · done outbox 정리(크론 1스텝).
create or replace function public.rpc_gc_sheets_sync(p_days int default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(1, p_days));
begin
  delete from sheet_inbox_dedup where created_at < v_cutoff;
  delete from sync_log          where created_at < v_cutoff;
  delete from sync_outbox       where status = 'done' and updated_at < v_cutoff;
end;
$$;

revoke all on function public.rpc_claim_sheet_outbox(int)              from public;
revoke all on function public.rpc_ensure_sheet_row_map(uuid, uuid)    from public;
revoke all on function public.rpc_fail_sheet_outbox(bigint, text)     from public;
revoke all on function public.rpc_gc_sheets_sync(int)                 from public;
grant execute on function public.rpc_claim_sheet_outbox(int)           to service_role;
grant execute on function public.rpc_ensure_sheet_row_map(uuid, uuid)  to service_role;
grant execute on function public.rpc_fail_sheet_outbox(bigint, text)   to service_role;
grant execute on function public.rpc_gc_sheets_sync(int)               to service_role;
