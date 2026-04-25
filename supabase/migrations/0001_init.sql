-- ============================================================================
-- 0001_init.sql — Phase 1 초기 스키마
-- Source of truth: D:\walltvprowiki\13_PROJECT_MANAGEMENT\MOUNTPARTNERS_APP\02_IA\02_ERD.md §3·§4·§5
-- 대상: 21 테이블 + 뷰 2 + 트리거 함수 3 + app_settings seed 10키
-- 네이밍 원칙: ERD §3 단일 기준 (admin_users / audit_events / ip_whitelist 컬럼)
-- ============================================================================

-- 0. 확장 활성화 (Supabase 기본 제공)
create extension if not exists pgcrypto     with schema extensions;
create extension if not exists "uuid-ossp"  with schema extensions;
create extension if not exists pg_trgm      with schema extensions;

-- ============================================================================
-- 1. admin_users (ERD §3.18)
-- ============================================================================
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  email text unique not null,
  role text not null default 'cs_admin' check (role in (
    'super_admin','cs_admin','dispatch_admin','ops_admin','auditor'
  )),
  ip_whitelist jsonb not null default '[]'::jsonb,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  status text default 'active' check (status in ('active','paused','terminated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column admin_users.role is
  '관리자 역할 (5종): super_admin=대표, cs_admin=본사CS, dispatch_admin=배차담당, ops_admin=쿠팡CS, auditor=감사';
comment on column admin_users.ip_whitelist is
  '허용 IP CIDR 목록 (JSON). 빈 배열이면 IP 제한 없음. 관리자 로그인 시 middleware에서 검증.';
comment on column admin_users.failed_login_count is
  '로그인 실패 누적 (성공 시 0 리셋). 5회 초과 시 locked_until = now()+10min.';

-- ============================================================================
-- 2. technicians (ERD §3.1)
-- ============================================================================
create table technicians (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  login_id text unique not null,
  display_name text not null,
  phone text not null,
  email text,
  birth_date date,
  vehicle_number text,
  home_base_region text,
  preferred_regions text[] default '{}',
  grade text default 'bronze' check (grade in ('bronze','silver','gold')),
  daily_max_jobs int default 6,
  weekend_enabled boolean default false,
  status text default 'active' check (status in ('active','paused','terminated')),
  device_fingerprint_primary text,
  device_fingerprints_all text[] default '{}',
  last_pw_changed_at timestamptz default now(),
  failed_login_count int default 0,
  locked_until timestamptz,
  last_known_lat numeric(10,7),
  last_known_lng numeric(10,7),
  last_location_updated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_technicians_status on technicians(status) where status = 'active';
create index idx_technicians_preferred_regions on technicians using gin(preferred_regions);

-- ============================================================================
-- 3. customers (ERD §3.2)
-- ============================================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  name_encrypted bytea not null,
  phone_encrypted bytea not null,
  phone_tail4 text not null,
  address_road_encrypted bytea,
  address_detail_encrypted bytea,
  address_region_sido text,
  address_region_sigungu text,
  address_lat numeric(10,7),
  address_lng numeric(10,7),
  coupang_customer_id text,
  pii_retained_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_customers_coupang on customers(coupang_customer_id);
create index idx_customers_region on customers(address_region_sido, address_region_sigungu);
create index idx_customers_retention on customers(pii_retained_until)
  where pii_retained_until is not null;

-- ============================================================================
-- 4. orders (ERD §3.4) — customers / technicians 참조
-- ============================================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  coupang_order_id text unique not null,
  order_received_at timestamptz not null,
  customer_id uuid not null references customers(id),
  tv_brand text,
  tv_model text,
  tv_size_inch int,
  tv_serial text,
  option_selected text not null check (option_selected in ('A_stand','B_drill','C_no_drill')),
  price_option_a numeric(12,2),
  price_option_b numeric(12,2) not null,
  price_option_c numeric(12,2) not null,
  price_paid_by_customer_to_coupang numeric(12,2) not null,
  currency text default 'KRW',
  requested_install_date date,
  requested_install_date_2 date,
  scheduled_installation_at timestamptz,
  scheduled_tz text default 'Asia/Seoul',
  status text not null default 'received'
    check (status in (
      'received',
      'happy_call_pending', 'happy_call_done',
      'scheduled', 'assigned',
      'en_route', 'on_site', 'in_progress',
      'no_drill_completed', 'drill_converted_completed',
      'awaiting_payment', 'payment_sent', 'paid',
      'postponed', 'on_hold',
      'cancel_requested', 'cancel_confirmed_coupang_transfer',
      'closed'
    )),
  status_changed_at timestamptz default now(),
  assigned_technician_id uuid references technicians(id),
  assigned_at timestamptz,
  happy_call_result text check (happy_call_result in ('high','medium','low','unavailable')),
  wall_type text check (wall_type in ('concrete','drywall_cavity','drywall_solid','unknown')),
  special_notes text,
  conversion_from_no_drill boolean default false,
  conversion_difference_amount numeric(12,2),
  conversion_agreed_method text check (conversion_agreed_method in ('verbal','sms','phone')),
  conversion_agreed_at timestamptz,
  coupang_paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  retention_until date
);

comment on column orders.coupang_paid_at is
  '쿠팡결제완료시각 — ETL에서 세팅. 무타공 완료 시 NOT NULL이면 awaiting_payment 건너뛰고 paid 직행.';

create index idx_orders_status on orders(status);
create index idx_orders_scheduled on orders(scheduled_installation_at)
  where status in ('scheduled','assigned','en_route','on_site','in_progress');
create index idx_orders_technician on orders(assigned_technician_id, scheduled_installation_at desc);
create index idx_orders_received_at on orders(order_received_at desc);
create index idx_orders_coupang on orders(coupang_order_id);

-- D+2 리드타임 체크 (E8-S4, ERD §3.4 마지막)
alter table orders add constraint chk_lead_time
  check (
    scheduled_installation_at is null
    or scheduled_installation_at >= order_received_at + interval '2 days'
    or (scheduled_installation_at < order_received_at + interval '2 days'
        and special_notes like '%[override:%')
  );

-- ============================================================================
-- 5. coupang_order_staging (ERD §3.3) — orders 참조
-- ============================================================================
create table coupang_order_staging (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('csv_upload','xlsx_upload','sheets_poll','email_ingest','manual')),
  source_meta jsonb not null default '{}'::jsonb,
  raw_data jsonb not null,
  mapped_data jsonb,
  validation_status text default 'pending'
    check (validation_status in ('pending','ok','error')),
  validation_errors jsonb,
  promoted_order_id uuid references orders(id),
  created_at timestamptz default now(),
  promoted_at timestamptz
);

create index idx_staging_status on coupang_order_staging(validation_status);
create index idx_staging_source on coupang_order_staging(source, created_at desc);

-- ============================================================================
-- 6. installations (ERD §3.5)
-- ============================================================================
create table installations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id) on delete cascade,
  technician_id uuid not null references technicians(id),
  departed_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  arrived_lat numeric(10,7),
  arrived_lng numeric(10,7),
  completed_lat numeric(10,7),
  completed_lng numeric(10,7),
  result_type text check (result_type in (
    'no_drill_success', 'drill_converted', 'postponed', 'cancelled'
  )),
  on_site_notes text,
  predicted_outcome text,
  actual_outcome text,
  route_sequence int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column installations.route_sequence is
  'DEPRECATED (rev 4 TSP 철회): NULL 고정. Phase 2 cleanup 시 drop 예정. 런타임 정렬은 scheduled_at ASC 기준 클라이언트 측.';

create index idx_installations_order on installations(order_id);
create index idx_installations_tech_date on installations(technician_id, completed_at desc);
create index idx_installations_tech_route on installations(technician_id, route_sequence)
  where route_sequence is not null;

-- ============================================================================
-- 7. photos (ERD §3.6)
-- ============================================================================
create table photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  installation_id uuid references installations(id),
  technician_id uuid not null references technicians(id),
  slot text not null check (slot in (
    'pre_tv_screen', 'pre_wall',
    'in_progress',
    'post_front', 'post_left', 'post_right',
    'extra', 'issue_evidence'
  )),
  storage_tier text not null default 'hot' check (storage_tier in ('hot','warm','cold')),
  supabase_path text,
  r2_key text,
  thumbnail_supabase_path text,
  mime_type text default 'image/webp',
  size_bytes int,
  width int,
  height int,
  sha256 text,
  taken_at timestamptz,
  taken_lat numeric(10,7),
  taken_lng numeric(10,7),
  uploaded_at timestamptz default now(),
  tier_changed_at timestamptz,
  access_count int default 0,
  last_accessed_at timestamptz
);

create index idx_photos_order on photos(order_id);
create index idx_photos_tier on photos(storage_tier, uploaded_at);
create unique index idx_photos_sha256 on photos(sha256) where sha256 is not null;

-- ============================================================================
-- 8. issues (ERD §3.7)
-- ============================================================================
create table issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  technician_id uuid not null references technicians(id),
  reported_at timestamptz default now(),
  category text not null check (category in (
    'no_drill_impossible',
    'customer_absent',
    'address_inaccessible',
    'tv_model_mismatch',
    'wall_damage_found',
    'etc'
  )),
  sub_reasons text[] default '{}',
  note text,
  photo_ids uuid[] default '{}',
  auto_triggered_action text,
  created_at timestamptz default now()
);

create index idx_issues_order on issues(order_id);
create index idx_issues_category on issues(category, reported_at desc);

-- ============================================================================
-- 9. cancellation_reports (ERD §3.8)
-- ============================================================================
create table cancellation_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id) on delete cascade,
  technician_id uuid not null references technicians(id),
  category_primary text not null check (category_primary in (
    'no_drill_structural', 'conversion_declined',
    'customer_absent_3times', 'address_issue',
    'tv_model_mismatch', 'etc'
  )),
  sub_reasons text[] default '{}',
  situation_note text not null,
  photo_ids uuid[] not null default '{}',
  signature_image_url text not null,
  coupang_transfer_status text default 'pending' check (coupang_transfer_status in (
    'pending','included_in_daily','included_in_weekly','transferred_manually'
  )),
  coupang_transfer_at timestamptz,
  created_at timestamptz default now()
);

create index idx_cancel_reports_category on cancellation_reports(category_primary);
create index idx_cancel_reports_transfer on cancellation_reports(coupang_transfer_status);

-- ============================================================================
-- 10. happy_calls (ERD §3.9) — admin_users 참조
-- ============================================================================
create table happy_calls (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  admin_user_id uuid not null references admin_users(id),
  called_at timestamptz default now(),
  wall_type text check (wall_type in ('concrete','drywall_cavity','drywall_solid','unknown')),
  outlet_position text check (outlet_position in ('upper_80_90','middle','lower','unknown')),
  outlet_condition_note text,
  interference_note text,
  tv_box_unopened boolean,
  preferred_time_1 timestamptz,
  preferred_time_2 timestamptz,
  parking_available boolean,
  elevator_size text,
  additional_options text[] default '{}',
  auto_verdict text check (auto_verdict in ('high','medium','low','unavailable')),
  verdict_reasoning text,
  free_note text,
  created_at timestamptz default now()
);

create index idx_happy_calls_order on happy_calls(order_id, called_at desc);

-- ============================================================================
-- 11. call_logs (ERD §3.10)
-- ============================================================================
create table call_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  technician_id uuid not null references technicians(id),
  type text not null check (type in ('pre_arrival_30min','post_arrival','on_demand')),
  called_at timestamptz default now(),
  call_duration_seconds int,
  call_outcome text check (call_outcome in (
    'answered','no_answer','busy','unreachable','manual_marked_done'
  )),
  reminder_sent_at timestamptz,
  warning_sent_at timestamptz,
  admin_alerted_at timestamptz,
  created_at timestamptz default now()
);

create index idx_call_logs_order on call_logs(order_id);
create index idx_call_logs_type on call_logs(type, called_at desc);

-- ============================================================================
-- 12. dispatches (ERD §3.11) — admin_users 참조
-- ============================================================================
create table dispatches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  recommendation_run_id uuid,
  rank int,
  technician_id uuid not null references technicians(id),
  score numeric(10,4),
  score_breakdown jsonb,
  assigned boolean default false,
  assigned_at timestamptz,
  assigned_by_admin_user_id uuid references admin_users(id),
  override_reason text,
  created_at timestamptz default now()
);

create index idx_dispatches_order on dispatches(order_id, assigned desc, rank);
create index idx_dispatches_tech on dispatches(technician_id, assigned_at desc) where assigned = true;

-- ============================================================================
-- 13. payment_links (ERD §3.12) — self-reference
-- ============================================================================
create table payment_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  purpose text not null check (purpose in ('full_charge','conversion_diff','reissue')),
  amount numeric(12,2) not null,
  pg_provider text not null check (pg_provider in ('portone','toss','innopay','nicepay','payapp')),
  pg_link_token text unique not null,
  idempotency_key text unique not null,
  short_url text,
  sent_via text[] not null default '{sms}',
  sent_at timestamptz default now(),
  expires_at timestamptz not null,
  reissue_of_link_id uuid references payment_links(id),
  reissue_count int default 0,
  status text default 'pending' check (status in (
    'pending','clicked','paid','expired','cancelled','failed'
  )),
  synced_to_sheet_at timestamptz,
  sheet_row_number int,
  created_at timestamptz default now()
);

create index idx_payment_links_order on payment_links(order_id, created_at desc);
create index idx_payment_links_status on payment_links(status) where status in ('pending','clicked');

-- ============================================================================
-- 14. payments (ERD §3.13)
-- ============================================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  payment_link_id uuid references payment_links(id),
  amount numeric(12,2) not null,
  currency text default 'KRW',
  pg_provider text not null,
  pg_approval_no text,
  pg_tid text,
  method text,
  paid_at timestamptz not null,
  webhook_idempotency_key text unique not null,
  webhook_received_at timestamptz,
  webhook_verified boolean default false,
  webhook_raw jsonb,
  refunded_at timestamptz,
  refund_amount numeric(12,2),
  refund_reason text,
  created_at timestamptz default now()
);

create index idx_payments_order on payments(order_id);
create index idx_payments_paid_at on payments(paid_at desc);

-- ============================================================================
-- 15. technician_availabilities (ERD §3.14)
-- ============================================================================
create table technician_availabilities (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references technicians(id) on delete cascade,
  default_workday_start time default '09:00',
  default_workday_end time default '18:00',
  default_weekend_enabled boolean default false,
  special_date date,
  special_available boolean,
  special_note text,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz default now()
);

create index idx_avail_tech on technician_availabilities(technician_id, special_date);

-- ============================================================================
-- 16. notifications (ERD §3.15)
-- ============================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  recipient_type text not null check (recipient_type in (
    'technician','customer','admin','coupang_cls'
  )),
  recipient_id uuid,
  recipient_phone text,
  channel text not null check (channel in ('push','sms','lms','kakao_alimtalk','email')),
  template_id text,
  payload jsonb not null,
  provider text,
  provider_message_id text,
  status text default 'queued' check (status in ('queued','sent','delivered','failed','bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  idempotency_key text unique,
  created_at timestamptz default now()
);

create index idx_notifications_order on notifications(order_id);
create index idx_notifications_status on notifications(status) where status in ('queued','failed');

-- ============================================================================
-- 17. audit_events (ERD §3.16)
-- ============================================================================
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('admin','technician','system','customer')),
  actor_id uuid,
  action text not null,
  subject_type text not null,
  subject_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz default now() not null
);

create index idx_audit_subject on audit_events(subject_type, subject_id, occurred_at desc);
create index idx_audit_actor on audit_events(actor_type, actor_id, occurred_at desc);
create index idx_audit_action on audit_events(action, occurred_at desc);

-- ============================================================================
-- 18. app_settings (ERD §3.17) — admin_users 참조
-- ============================================================================
create table app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references admin_users(id)
);

-- app_settings 기본 seed (ERD §3.17 · BACKEND_SUPABASE §12)
insert into app_settings (key, value, description) values
  ('dispatch_weights',
    '{"w1":1.0,"w2":1.0,"w3":0.5,"w4":1.5,"w5":1.0,"w6":0.3}'::jsonb,
    '배차 가중치 (E8-S2)'),
  ('dispatch_gini_threshold',
    '0.3'::jsonb,
    '지니계수 편파 방지 임계 — 3개월 run-in 후 soft_balance 검토'),
  ('dispatch_gini_mode',
    '"hard_balance"'::jsonb,
    'Gini 배차 모드 (07_DISPATCH_ALGORITHM)'),
  ('weekend_operation_global',
    'false'::jsonb,
    'Phase 1 기본 주말 off'),
  ('daily_report_recipients',
    '[]'::jsonb,
    '일일 리포트 수신자 (채널·주소 리스트)'),
  ('photo_lifecycle_hot_days',
    '90'::jsonb,
    'Hot 보관 기간 (일). 초과 시 Warm 이관'),
  ('payment_link_expiry_hours',
    '72'::jsonb,
    '결제 링크 만료 (시간)'),
  ('unpaid_reminder_schedule',
    '[24,48,72,168]'::jsonb,
    '미수금 알림 시점 (시간 단위)'),
  ('privacy_retention',
    '{"photos_years":10,"pii_years":5,"call_logs_years":3}'::jsonb,
    '데이터 보관 기간 (PIPA §10.3)'),
  ('pg_primary',
    '"portone"'::jsonb,
    '결제 허브 PG');

-- ============================================================================
-- 19. technician_vacations (ERD §3.19) — admin_users 참조
-- ============================================================================
create table technician_vacations (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references technicians(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz default now(),
  created_by uuid references admin_users(id),
  check (end_date >= start_date)
);

create index idx_tech_vacations_date on technician_vacations(technician_id, start_date, end_date);

comment on table technician_vacations is
  '기사 휴가 구간. W2 근무관리 (A-13) · 배차 제외 조건. 본인 입력(created_by=NULL) 또는 관리자 override.';

-- ============================================================================
-- 20. technician_recurring_offdays (ERD §3.20)
-- ============================================================================
create table technician_recurring_offdays (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references technicians(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  active boolean not null default true,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (technician_id, day_of_week)
);

comment on table technician_recurring_offdays is
  '기사 고정 휴무 요일 (주 단위 반복). 0=일, 1=월, ..., 6=토 (extract(dow) 호환).';

-- ============================================================================
-- 21. technician_service_areas (ERD §3.21)
-- ============================================================================
create table technician_service_areas (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references technicians(id) on delete cascade,
  region_sido text not null,
  region_sigungu text not null,
  priority int not null default 1 check (priority between 1 and 3),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (technician_id, region_sido, region_sigungu)
);

create index idx_tech_areas_region on technician_service_areas(region_sido, region_sigungu, active);

comment on table technician_service_areas is
  '기사 가용 지역 매트릭스. 배차 알고리즘 지역 매칭 기반.';
comment on column technician_service_areas.priority is
  '1=우선 배차 지역, 2=여력 있을 때 보조, 3=긴급 상황만 (거리 페널티 허용).';

-- ============================================================================
-- 뷰 §4.1 — v_orders_dashboard (관리자 Kanban)
-- ============================================================================
create or replace view v_orders_dashboard as
select
  o.id,
  o.coupang_order_id,
  o.status,
  o.scheduled_installation_at,
  o.option_selected,
  o.price_option_b - o.price_option_c as potential_conversion_diff,
  o.conversion_difference_amount,
  c.phone_tail4,
  c.address_region_sigungu,
  t.display_name as technician_name,
  t.grade as technician_grade,
  o.tv_brand || ' ' || o.tv_model || ' (' || o.tv_size_inch || '")' as tv_display,
  (select count(*) from photos p where p.order_id = o.id and p.slot like 'pre_%')  as pre_photos,
  (select count(*) from photos p where p.order_id = o.id and p.slot like 'post_%') as post_photos,
  -- 결제 lifecycle 은 payment_links.status 가 단일 원천 (pending/clicked/paid/expired/cancelled/failed).
  -- ERD §3.13 payments 에는 status 컬럼이 없음 (트랜잭션 기록 자체) → §4.1 본문 오기 정정.
  (select pl.status from payment_links pl where pl.order_id = o.id order by pl.created_at desc limit 1) as last_payment_status
from orders o
join customers c on c.id = o.customer_id
left join technicians t on t.id = o.assigned_technician_id;

-- ============================================================================
-- 뷰 §4.2 — v_technician_today (기사 오늘 시공건)
-- ============================================================================
create or replace view v_technician_today as
select
  o.id as order_id,
  o.assigned_technician_id,
  o.scheduled_installation_at,
  o.status,
  c.phone_tail4,
  c.address_region_sido || ' ' || c.address_region_sigungu as region,
  o.tv_brand || ' ' || o.tv_model as tv,
  exists(
    select 1 from call_logs cl
    where cl.order_id = o.id
      and cl.type = 'pre_arrival_30min'
      and cl.call_outcome in ('answered','manual_marked_done')
  ) as pre_call_done,
  (select count(*) from photos p where p.order_id = o.id) as photo_count
from orders o
join customers c on c.id = o.customer_id
where o.scheduled_installation_at::date = current_date
  and o.status in ('assigned','en_route','on_site','in_progress');

-- ============================================================================
-- 트리거 §5.1 — updated_at 자동 갱신
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- updated_at 컬럼이 있는 8 테이블에만 적용
create trigger trg_admin_users_updated    before update on admin_users    for each row execute function set_updated_at();
create trigger trg_technicians_updated    before update on technicians    for each row execute function set_updated_at();
create trigger trg_customers_updated      before update on customers      for each row execute function set_updated_at();
create trigger trg_orders_updated         before update on orders         for each row execute function set_updated_at();
create trigger trg_installations_updated  before update on installations  for each row execute function set_updated_at();
create trigger trg_app_settings_updated   before update on app_settings   for each row execute function set_updated_at();
create trigger trg_tech_offday_updated    before update on technician_recurring_offdays for each row execute function set_updated_at();
create trigger trg_tech_area_updated      before update on technician_service_areas     for each row execute function set_updated_at();

-- ============================================================================
-- 트리거 §5.2 — orders.status 변경 시 audit_events 자동 기록
-- ============================================================================
create or replace function audit_order_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into audit_events (actor_type, action, subject_type, subject_id, before_value, after_value)
    values (
      coalesce(current_setting('app.current_actor_type', true), 'system'),
      'order.status_change',
      'order', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_orders_audit before update on orders
  for each row execute function audit_order_status_change();

-- ============================================================================
-- 트리거 §5.3 — D+2 리드타임 override 감사
-- ============================================================================
create or replace function audit_lead_time_override()
returns trigger language plpgsql as $$
begin
  if new.scheduled_installation_at is not null
     and new.scheduled_installation_at < new.order_received_at + interval '2 days' then
    insert into audit_events (actor_type, action, subject_type, subject_id, after_value)
    values (
      coalesce(current_setting('app.current_actor_type', true), 'system'),
      'order.lead_time_override',
      'order', new.id,
      jsonb_build_object(
        'order_received_at', new.order_received_at,
        'scheduled', new.scheduled_installation_at,
        'delta_hours', extract(epoch from (new.scheduled_installation_at - new.order_received_at)) / 3600
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_orders_lead_time
  before insert or update of scheduled_installation_at on orders
  for each row execute function audit_lead_time_override();
