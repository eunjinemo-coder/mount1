-- ============================================================================
-- 0021_store.sql — P0 무타공 브라켓 스토어 (스키마 · RLS · RPC)
-- Source of truth: 02_PRD_P0_STORE.md §2(DB) · §5(멱등) · §7(보안)
--   (PRD 본문은 "0020_store.sql" 로 명명했으나 0020 은 이미 점유 → 0021 로 채번)
--
-- 이 마이그레이션이 담는 것:
--   · 9 테이블 (store_products / store_variants / store_price_tiers /
--     store_orders / store_order_items / store_shipments /
--     store_quote_requests / store_message_log / store_order_events)
--   · RLS — 공개면(products/variants/tiers)은 published/active 만 anon SELECT.
--     주문계열(orders/items/shipments/message_log/events)은 anon 직접접근 전면차단,
--     쓰기·조회는 아래 SECURITY DEFINER RPC 로만.
--   · RPC — create_store_order / lookup_store_order / confirm_store_payment
--     + rpc_admin_get_store_buyer_phone (PII 복호화, 감사로그)
--
-- ── PRD 대비 의도적 편차 (project 컨벤션 우선) ──────────────────────────────
--   1) buyer_phone: PRD §2 는 `buyer_phone text` 로 선언하되 §7 에서 "Vault 패턴
--      암호화 저장 + 복호화 RPC" 를 요구함. 두 요구가 스키마 레벨에서 상충하므로
--      V1 customers.phone_encrypted 컨벤션(0011_pii_decrypt.sql)을 따라
--        · buyer_phone_encrypted bytea  — pgp_sym_encrypt(pii_key) 저장
--        · buyer_phone_tail4     text   — 어드민 목록 대조용 뒷 4자리 (평문)
--      로 분리 저장한다. 평문 원문은 어떤 컬럼에도 남기지 않는다.
--      → 원문 전화번호는 lookup_store_order / rpc_admin_get_store_buyer_phone
--        (둘 다 SECURITY DEFINER) 안에서만 복호화된다.
--   2) buyer_name / ship_addr* / depositor_name / biz_reg_no 는 PRD §2 스키마
--      그대로 평문 유지. 단 anon SELECT 는 RLS 로 전면차단(정책 부재=deny),
--      어드민(super_admin/ops_admin)·감사(auditor)만 접근. 전화번호 외 PII 의
--      추가 암호화는 향후 하드닝 과제로 남긴다(TODO: store PII 2차 암호화).
--   3) create_store_order 는 재고를 차감하지 않는다(PRD §5 — 재고는 입금확인
--      시점 confirm_store_payment 에서 차감). 주문 시점엔 qty<=stock_qty 검증만.
--   4) order_no 포맷: PRD §2 는 'WP'+yymmdd+4자리. 4자리(일 10^4)는 브루트포스
--      가능하여 리뷰(FIX-2)에 따라 'WP'+yymmdd+'-'+6자리(일 10^6, 예 WP260703-483920)
--      로 확장. 하이픈은 전화 안내 가독성용. (PRD 대비 자릿수·구분자 편차)
--
-- ── 리뷰 반영(FIX-1~6, database-reviewer + security-reviewer APPROVE-WITH-FIXES) ──
--   · FIX-1: 주문계열 어드민 RLS 를 SELECT+UPDATE 로 축소(INSERT/DELETE 제거),
--            store_order_events FK 의 on delete cascade 제거(감사이력 보존).
--            ⚠️ 파생: store_shipments INSERT 도 차단됨 → R4 에서 운송장 등록용
--               register_store_shipment RPC(또는 전용 INSERT 정책) 필요.
--   · FIX-2: order_no 6자리화 + lookup 미존재 경로 pgp 연산 1회(타이밍 단차 '완화').
--   · FIX-3: create_store_order 입력 상한(items≤50, 자유입력 길이) + 테이블 CHECK.
--   · FIX-4: items 요소 uuid/qty 형식 사전검증(캐스팅 전 22P02 노출·음수 스머글링 차단).
--   · FIX-5: store_message_log(order_id) 인덱스 + store_quote_requests CHECK(anon INSERT 방어).
--   · FIX-6: 나머지 테이블 comment 보강.
--   · FIX-7: store_quote_requests anon INSERT 를 status='new' 로 제한(스텔스 스팸 차단).
--   · FIX-8: lookup pii_key() 1회 평가(v_key) + 타이밍 잔여비대칭·완전상수시간화(R4) 문서화.
--
-- 사전조건: Vault 에 'pii_key' 시크릿 등록(0011 HANDOFF #21). 미등록 시
--   create_store_order 가 pii_key_missing 으로 실패한다(주문 전체 롤백).
--   본 프로젝트는 V1(customers) 이 이미 동일 키에 의존하므로 등록되어 있어야 함.
-- ============================================================================

-- ============================================================================
-- 1. store_products — 상품 (상세페이지 = /p/[slug] 랜딩)
-- ============================================================================
create table store_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  content jsonb not null default '[]'::jsonb,   -- 상세 섹션 배열 [{type:'hero'|'spec'|'gallery'|'compare'|'faq', ...}]
  images text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_store_products_published on store_products(sort, created_at desc)
  where status = 'published';

comment on table store_products is 'P0 스토어 상품. content=상세 섹션 배열(랜딩 렌더). status=published 만 공개.';

-- ============================================================================
-- 2. store_variants — 변형 (인치호환/색상 등)
-- ============================================================================
create table store_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references store_products(id) on delete cascade,
  name text not null,
  sku text unique not null,
  base_price int not null check (base_price >= 0),   -- 1개 단가(원)
  stock_qty int not null default 0 check (stock_qty >= 0),
  active boolean not null default true
);

create index idx_store_variants_product on store_variants(product_id);

comment on column store_variants.base_price is '1개 기준 단가(원). 수량구간 할인은 store_price_tiers 참조. 서버 재계산 원천.';

-- ============================================================================
-- 3. store_price_tiers — 수량 구간 단가 (도매)
-- ============================================================================
create table store_price_tiers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references store_variants(id) on delete cascade,
  min_qty int not null check (min_qty > 0),     -- 이 수량 이상이면
  unit_price int not null check (unit_price >= 0),
  unique (variant_id, min_qty)
);

create index idx_store_price_tiers_variant on store_price_tiers(variant_id, min_qty desc);

-- ============================================================================
-- 4. store_orders — 주문 (비회원, 주문자 정보 인라인)
--    buyer_phone 은 편차1 참조 → encrypted(bytea) + tail4(text) 분리
-- ============================================================================
create table store_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,                -- 'WP' || yymmdd || '-' || 6자리 (예: WP260703-483920)
  client_key uuid unique not null,              -- 멱등성: 폼 마운트 시 생성, 이중제출 차단
  status text not null default 'awaiting_payment' check (status in
    ('awaiting_payment','paid','preparing','shipped','delivered','cancelled','expired')),
  buyer_name text not null check (length(buyer_name) between 1 and 100),
  buyer_phone_encrypted bytea not null,         -- pgp_sym_encrypt(pii_key) — 편차1
  buyer_phone_tail4 text not null,              -- 어드민 목록 대조용 뒷4자리(평문)
  buyer_company text check (buyer_company is null or length(buyer_company) <= 100),
  tax_invoice boolean not null default false,
  biz_reg_no text check (biz_reg_no is null or length(biz_reg_no) <= 20),  -- 세금계산서 요청 시 (숫자 10자리)
  ship_postcode text not null check (length(ship_postcode) between 1 and 20),
  ship_addr1 text not null check (length(ship_addr1) between 1 and 300),
  ship_addr2 text check (ship_addr2 is null or length(ship_addr2) <= 300),
  ship_memo text check (ship_memo is null or length(ship_memo) <= 500),
  payment_method text not null default 'bank_transfer',
  depositor_name text check (depositor_name is null or length(depositor_name) <= 100),  -- 입금자명 (주문자와 다를 수 있음)
  total_amount int not null check (total_amount >= 0),
  paid_at timestamptz,
  paid_by uuid,                                 -- 입금확인 어드민 (auth.uid())
  reminder_sent_at timestamptz,                 -- 미입금 리마인드 멱등 마커
  expires_at timestamptz not null,             -- 입금기한 (생성+72h)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_store_orders_status_created on store_orders(status, created_at desc);
create index idx_store_orders_expires on store_orders(expires_at)
  where status = 'awaiting_payment';

comment on column store_orders.buyer_phone_encrypted is
  '구매자 휴대폰 암호문(pgp_sym_encrypt, Vault pii_key). 복호화는 lookup_store_order/rpc_admin_get_store_buyer_phone 만.';

-- ============================================================================
-- 5. store_order_items — 주문 항목 (단가 스냅샷)
-- ============================================================================
create table store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  variant_id uuid not null references store_variants(id),
  qty int not null check (qty > 0),
  unit_price int not null check (unit_price >= 0),   -- 스냅샷 (구간할인 반영가)
  subtotal int not null check (subtotal >= 0)
);

create index idx_store_order_items_order on store_order_items(order_id);
create index idx_store_order_items_variant on store_order_items(variant_id);

-- ============================================================================
-- 6. store_shipments — 배송 (주문당 1건 = 멱등)
-- ============================================================================
create table store_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references store_orders(id) on delete cascade,
  carrier text not null check (carrier in ('cj','lotte','hanjin','logen','post')),
  tracking_no text not null,
  shipped_at timestamptz not null default now()
);

comment on table store_shipments is
  '배송 정보. order_id unique = 주문당 1건(멱등). 운송장 수정은 UPDATE 로만(중복 등록 차단).';

-- ============================================================================
-- 7. store_quote_requests — 대량 견적요청 (리드)
-- ============================================================================
create table store_quote_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null check (length(company) between 1 and 100),
  contact_name text not null check (length(contact_name) between 1 and 100),
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),  -- 숫자만·한국 휴대폰(create_store_order 와 동일 패턴)
  message text not null check (length(message) between 1 and 1000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

create index idx_store_quote_requests_status on store_quote_requests(status, created_at desc);

comment on table store_quote_requests is
  '대량 견적요청 리드. anon 직접 INSERT 허용 테이블 → 테이블 레벨 CHECK 로 방어(길이·전화형식). 조회/수정은 어드민만.';
comment on column store_quote_requests.phone is
  'anon 직접입력 — 숫자만 저장하도록 앱단에서 정규화 후 INSERT 권장(CHECK 는 하이픈 미허용).';

-- ============================================================================
-- 8. store_message_log — SMS 발송 로그 (멱등 + 재시도)
-- ============================================================================
create table store_message_log (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique not null,              -- 예: 'order_received:{order_id}'
  order_id uuid references store_orders(id) on delete set null,
  template text not null,
  to_phone text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_store_message_log_retry on store_message_log(status, attempts)
  where status in ('pending','failed');
create index idx_store_message_log_order on store_message_log(order_id);

comment on table store_message_log is
  'SMS 발송 로그. dedupe_key unique 로 크론 중복실행에도 중복발송 차단. status pending/failed(attempts<3) 는 크론 재발송 대상.';

-- ============================================================================
-- 9. store_order_events — 상태 변경 감사 이력
-- ============================================================================
create table store_order_events (
  id bigint generated always as identity primary key,
  -- FIX-1: cascade 제거 — 주문이 하드삭제되더라도 감사이력은 생존해야 함.
  --   (RLS 상 어드민 DELETE 정책도 제거했으므로 정상경로에서 주문삭제는 발생 안 함)
  order_id uuid not null references store_orders(id),
  from_status text,
  to_status text not null,
  actor text not null,                          -- 'system' | admin uuid | 'buyer'
  note text,
  created_at timestamptz not null default now()
);

create index idx_store_order_events_order on store_order_events(order_id, created_at);

comment on table store_order_events is
  '주문 상태변경 감사 이력. 부모(store_orders) FK 는 cascade 없음 — 감사이력은 주문 삭제와 무관하게 보존(FIX-1).';

-- ============================================================================
-- updated_at 트리거 — 0001_init.sql 의 set_updated_at() 재사용
-- (updated_at 컬럼 보유: store_products / store_orders)
-- ============================================================================
create trigger trg_store_products_updated before update on store_products
  for each row execute function set_updated_at();
create trigger trg_store_orders_updated before update on store_orders
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS — 전 store_ 테이블 활성. 기본 DENY(정책 부재).
--   JWT/role helper 는 0002_rls.sql: is_admin() / has_admin_role() / admin_role().
-- ============================================================================
alter table store_products        enable row level security;
alter table store_variants        enable row level security;
alter table store_price_tiers     enable row level security;
alter table store_orders          enable row level security;
alter table store_order_items     enable row level security;
alter table store_shipments       enable row level security;
alter table store_quote_requests  enable row level security;
alter table store_message_log     enable row level security;
alter table store_order_events    enable row level security;

-- ── 공개면: 상품/변형/단가 — anon·authenticated 는 published/active 만 SELECT ──
create policy store_products_public_read on store_products for select
  using (status = 'published');

create policy store_variants_public_read on store_variants for select
  using (
    active
    and exists (
      select 1 from store_products p
      where p.id = store_variants.product_id and p.status = 'published'
    )
  );

create policy store_price_tiers_public_read on store_price_tiers for select
  using (
    exists (
      select 1 from store_variants v
      join store_products p on p.id = v.product_id
      where v.id = store_price_tiers.variant_id
        and v.active and p.status = 'published'
    )
  );

-- ── 어드민 관리(CRUD): super_admin + ops_admin. 감사(auditor) 는 읽기 ──
--   (V1 payments/staging 정책과 동일 등급 모델 — 결제·PII 취급 테이블)
create policy store_products_admin_all on store_products for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_products_auditor_read on store_products for select
  using (public.admin_role() = 'auditor');

create policy store_variants_admin_all on store_variants for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_variants_auditor_read on store_variants for select
  using (public.admin_role() = 'auditor');

create policy store_price_tiers_admin_all on store_price_tiers for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_price_tiers_auditor_read on store_price_tiers for select
  using (public.admin_role() = 'auditor');

-- ── 주문계열: anon 직접접근 정책 전무(=deny). 쓰기는 RPC(SECURITY DEFINER)로만. ──
--   FIX-1: 어드민은 SELECT + UPDATE 만(INSERT/DELETE 정책 제거).
--     · INSERT 를 막는 이유: create_store_order 의 서버 재계산·멱등을 우회한 임의
--       주문행 생성 차단. 주문 생성 유일 경로 = create_store_order RPC.
--     · DELETE 를 막는 이유: 주문 하드삭제로 store_order_events 감사이력 소멸 방지.
--       (PRD 상 어드민 취소는 status='cancelled' 전이로만 처리, 물리삭제 없음)
--     · 하드삭제가 필요해지면 V1 0002 orders_delete 처럼 super_admin 전용 별도
--       정책으로 추가할 것(이번 배치에서는 만들지 않음).
--   ⚠️ 운송장 등록(store_shipments INSERT)도 RLS 로 차단됨 → R4 에서
--      register_store_shipment SECURITY DEFINER RPC(또는 별도 INSERT 정책)로 처리 필요.
create policy store_orders_admin_read on store_orders for select
  using (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_orders_admin_update on store_orders for update
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_orders_auditor_read on store_orders for select
  using (public.admin_role() = 'auditor');

create policy store_order_items_admin_read on store_order_items for select
  using (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_order_items_admin_update on store_order_items for update
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_order_items_auditor_read on store_order_items for select
  using (public.admin_role() = 'auditor');

create policy store_shipments_admin_read on store_shipments for select
  using (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_shipments_admin_update on store_shipments for update
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));
create policy store_shipments_auditor_read on store_shipments for select
  using (public.admin_role() = 'auditor');

create policy store_order_events_admin_read on store_order_events for select
  using (public.has_admin_role(array['super_admin','ops_admin']) or public.admin_role() = 'auditor');

create policy store_message_log_admin_all on store_message_log for all
  using (public.has_admin_role(array['super_admin','ops_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin']));

-- ── 견적요청: anon INSERT 허용(리드 수집), 조회/수정은 어드민만 ──
--   FIX-7: 신규 리드는 항상 status='new' 로만 삽입 허용. anon 이 'closed'/'contacted'
--   로 직접 삽입해 A4 신규리드 필터를 우회하는 스텔스 스팸을 차단(비즈니스 규칙과도 일치).
create policy store_quote_requests_public_insert on store_quote_requests for insert
  with check (status = 'new');
create policy store_quote_requests_admin_all on store_quote_requests for all
  using (public.has_admin_role(array['super_admin','ops_admin','cs_admin']))
  with check (public.has_admin_role(array['super_admin','ops_admin','cs_admin']));

-- ============================================================================
-- RPC 1) create_store_order — 주문 생성 (anon 호출)
--   · 단가·총액 서버 재계산(클라 값 신뢰 금지) · qty<=stock 검증(차감 X)
--   · client_key 멱등(기존 주문 반환) · order_no 생성 충돌 1회 재시도
--   · buyer_phone 암호화 저장 + tail4 · expires_at=now()+72h · events(actor=buyer)
-- ============================================================================
create or replace function public.create_store_order(
  p_client_key uuid,
  p_items jsonb,                        -- [{"variant_id":"uuid","qty":2}, ...]
  p_buyer_name text,
  p_buyer_phone text,
  p_ship_postcode text,
  p_ship_addr1 text,
  p_buyer_company text default null,
  p_tax_invoice boolean default false,
  p_biz_reg_no text default null,
  p_ship_addr2 text default null,
  p_ship_memo text default null,
  p_depositor_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing store_orders%rowtype;
  v_phone_norm text;
  v_biz_norm text;
  v_lines jsonb := '[]'::jsonb;
  v_total int := 0;
  v_row record;
  v_variant record;
  v_unit int;
  v_order_id uuid;
  v_order_no text;
  v_expires timestamptz;
  v_attempt int := 0;
begin
  -- (0) 멱등: client_key 로 기존 주문 존재 시 그대로 반환
  select * into v_existing from store_orders where client_key = p_client_key;
  if found then
    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_no', v_existing.order_no,
      'total_amount', v_existing.total_amount,
      'expires_at', v_existing.expires_at
    );
  end if;

  -- (1) 입력 검증
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required' using errcode = 'P0001';
  end if;
  -- FIX-3: 항목 종류 상한 (DoS·페이로드 남용 차단)
  if jsonb_array_length(p_items) > 50 then
    raise exception '주문 항목이 너무 많습니다(최대 50종).' using errcode = 'P0001';   -- too_many_items
  end if;

  -- FIX-4: items 요소 형식 검증 — 2단계.
  --   (a) 캐스팅 없는 형식검증. OR 단락평가가 보장되지 않으므로 이 단계에서는 ::int/::uuid 캐스팅을
  --       절대 하지 않는다(22P02 원문 노출 차단). null 은 coalesce('') 로 정규식 불일치 유도.
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'variant_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or coalesce(e->>'qty', '') !~ '^[0-9]{1,6}$'     -- 1~999999자리, 음수·소수·오버플로우 차단
  ) then
    raise exception '주문 항목 형식이 올바르지 않습니다.' using errcode = 'P0001';        -- invalid_items
  end if;
  --   (b) (a) 통과 후 qty 는 전부 1~6자리 숫자문자열 → 안전 캐스팅. 0 은 여기서 거부(음수 스머글링 차단).
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where (e->>'qty')::int <= 0
  ) then
    raise exception '주문 수량은 1개 이상이어야 합니다.' using errcode = 'P0001';         -- invalid_qty
  end if;

  if p_buyer_name is null or length(trim(p_buyer_name)) = 0 then
    raise exception 'buyer_name_required' using errcode = 'P0001';
  end if;
  if length(trim(p_buyer_name)) > 100 then
    raise exception '주문자명이 너무 깁니다(최대 100자).' using errcode = 'P0001';       -- buyer_name_too_long
  end if;

  -- 휴대폰: 숫자만 추출 후 한국 휴대폰 형식 검증
  v_phone_norm := regexp_replace(coalesce(p_buyer_phone, ''), '\D', '', 'g');
  if v_phone_norm !~ '^01[016789][0-9]{7,8}$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  if p_ship_postcode is null or length(trim(p_ship_postcode)) = 0
     or p_ship_addr1 is null or length(trim(p_ship_addr1)) = 0 then
    raise exception 'shipping_required' using errcode = 'P0001';
  end if;
  -- FIX-3: 나머지 자유입력 필드 길이 상한 (테이블 CHECK 와 이중방어, 한국어 에러 우선)
  if length(trim(p_ship_postcode)) > 20
     or length(trim(p_ship_addr1)) > 300
     or length(trim(coalesce(p_ship_addr2, ''))) > 300
     or length(trim(coalesce(p_ship_memo, ''))) > 500
     or length(trim(coalesce(p_buyer_company, ''))) > 100
     or length(trim(coalesce(p_depositor_name, ''))) > 100 then
    raise exception '입력값 길이가 허용범위를 초과했습니다.' using errcode = 'P0001';    -- field_too_long
  end if;

  -- 세금계산서 요청 시 사업자번호(숫자 10자리) 필수
  if p_tax_invoice then
    v_biz_norm := regexp_replace(coalesce(p_biz_reg_no, ''), '\D', '', 'g');
    if v_biz_norm !~ '^[0-9]{10}$' then
      raise exception 'invalid_biz_reg_no' using errcode = 'P0001';
    end if;
  end if;

  -- (2) 항목 검증 + 서버 재계산 (variant 별 수량 합산 → 구간단가 적용)
  for v_row in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'qty')::int) as qty
    from jsonb_array_elements(p_items) e
    group by (e->>'variant_id')::uuid
  loop
    if v_row.qty is null or v_row.qty <= 0 then
      raise exception 'invalid_qty' using errcode = 'P0001';
    end if;

    select v.base_price, v.stock_qty, v.active, p.status
      into v_variant
      from store_variants v
      join store_products p on p.id = v.product_id
     where v.id = v_row.variant_id;

    if not found then
      raise exception 'variant_not_found' using errcode = 'P0001';
    end if;
    if not v_variant.active or v_variant.status <> 'published' then
      raise exception 'variant_unavailable' using errcode = 'P0001';
    end if;
    if v_row.qty > v_variant.stock_qty then
      raise exception 'insufficient_stock' using errcode = 'P0001';
    end if;

    -- 구간단가: qty 이하 최대 min_qty tier, 없으면 base_price
    select unit_price into v_unit
      from store_price_tiers
     where variant_id = v_row.variant_id and min_qty <= v_row.qty
     order by min_qty desc
     limit 1;
    if v_unit is null then
      v_unit := v_variant.base_price;
    end if;

    v_total := v_total + (v_unit * v_row.qty);
    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_row.variant_id,
      'qty', v_row.qty,
      'unit_price', v_unit,
      'subtotal', v_unit * v_row.qty
    );
  end loop;

  -- (3) 주문 INSERT — order_no 생성 충돌 시 1회 재시도.
  --     동시성 race 로 client_key unique 충돌 시엔 기존 주문 반환(멱등).
  v_expires := now() + interval '72 hours';
  loop
    v_attempt := v_attempt + 1;
    -- FIX-2: 랜덤부 6자리로 확장(일 10^6) — 브루트포스 내성 강화. 하이픈으로 가독성(전화 안내).
    --   포맷: 'WP' || yymmdd || '-' || 6자리  (예: WP260703-483920)
    v_order_no := 'WP'
      || to_char(timezone('Asia/Seoul', now()), 'YYMMDD')
      || '-'
      || lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into store_orders (
        order_no, client_key, status,
        buyer_name, buyer_phone_encrypted, buyer_phone_tail4, buyer_company,
        tax_invoice, biz_reg_no,
        ship_postcode, ship_addr1, ship_addr2, ship_memo,
        payment_method, depositor_name, total_amount, expires_at
      ) values (
        v_order_no, p_client_key, 'awaiting_payment',
        trim(p_buyer_name),
        extensions.pgp_sym_encrypt(v_phone_norm, public.pii_key()),
        right(v_phone_norm, 4),
        nullif(trim(coalesce(p_buyer_company, '')), ''),
        p_tax_invoice,
        case when p_tax_invoice then v_biz_norm else null end,
        trim(p_ship_postcode), trim(p_ship_addr1),
        nullif(trim(coalesce(p_ship_addr2, '')), ''),
        nullif(trim(coalesce(p_ship_memo, '')), ''),
        'bank_transfer',
        nullif(trim(coalesce(p_depositor_name, '')), ''),
        v_total, v_expires
      )
      returning id, expires_at into v_order_id, v_expires;
      exit;  -- 성공
    exception when unique_violation then
      -- client_key 동시충돌이면 기존 주문 반환(멱등), 아니면 order_no 재시도
      select * into v_existing from store_orders where client_key = p_client_key;
      if found then
        return jsonb_build_object(
          'order_id', v_existing.id,
          'order_no', v_existing.order_no,
          'total_amount', v_existing.total_amount,
          'expires_at', v_existing.expires_at
        );
      end if;
      if v_attempt >= 2 then
        raise exception 'order_no_generation_failed' using errcode = 'P0001';
      end if;
    end;
  end loop;

  -- (4) 항목 INSERT
  insert into store_order_items (order_id, variant_id, qty, unit_price, subtotal)
  select v_order_id,
         (l->>'variant_id')::uuid,
         (l->>'qty')::int,
         (l->>'unit_price')::int,
         (l->>'subtotal')::int
  from jsonb_array_elements(v_lines) l;

  -- (5) 이벤트 로그 (actor=buyer)
  insert into store_order_events (order_id, from_status, to_status, actor, note)
  values (v_order_id, null, 'awaiting_payment', 'buyer', 'order_created');

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'total_amount', v_total,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function public.create_store_order(uuid, jsonb, text, text, text, text, text, boolean, text, text, text, text) from public;
grant execute on function public.create_store_order(uuid, jsonb, text, text, text, text, text, boolean, text, text, text, text) to anon, authenticated;

-- ============================================================================
-- RPC 2) lookup_store_order — 주문 조회 (anon, 본인확인 = order_no + phone)
--   불일치/미존재 모두 NULL 반환 (열거 힌트 차단, 동일 응답)
--
--   타이밍 사이드채널 (FIX-2 완화 → FIX-8 보강):
--     · 미존재 경로에서도 pgp 연산을 1회 태워 "복호화 발생 여부" 단차를 '완화(mitigated)'.
--       완전 해소는 아님 — 잔여 비대칭이 남는다:
--         미존재 = encrypt+decrypt(crypto 2회) vs 존재+전화불일치 = decrypt(crypto 1회).
--         (방향이 반전돼 있어 단순 오라클로 쓰기는 어렵지만 상수시간은 아님)
--     · pii_key() 는 함수 도입부에서 1회만 평가(v_key) — 미존재 경로의 Vault 조회 2→1회로
--       존재 경로와의 격차를 축소(FIX-8).
--     · 완전 상수시간화(R4 하드닝 과제): 배포 시 1회 생성한 더미 암호문을 1행 테이블에
--       저장해 두고, 미존재 경로도 그 상수를 decrypt 1회만 수행하도록 대체.
-- ============================================================================
create or replace function public.lookup_store_order(
  p_order_no text,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order store_orders%rowtype;
  v_key text;
  v_phone_norm text;
  v_stored_norm text;
  v_items jsonb;
  v_shipment jsonb;
begin
  if p_order_no is null or p_phone is null then
    return null;
  end if;

  v_phone_norm := regexp_replace(p_phone, '\D', '', 'g');
  v_key := public.pii_key();   -- FIX-8: 모든 경로가 공유 (Vault 조회 1회)

  select * into v_order from store_orders where order_no = trim(p_order_no);
  if not found then
    -- FIX-2/8: 타이밍 단차 완화 — 미존재 경로에서도 pgp 연산을 1회 수행.
    --   (고정 상수 bytea 는 런타임 pii_key 와 키가 달라 복호화 시 예외 → 현재 키로
    --    즉석 round-trip. 완전 상수시간화는 위 헤더의 R4 과제 참조.)
    perform extensions.pgp_sym_decrypt(
      extensions.pgp_sym_encrypt('00000000000', v_key), v_key);
    return null;   -- 미존재 — 힌트 없음
  end if;

  -- 저장 암호문 복호화 후 대조
  v_stored_norm := regexp_replace(
    extensions.pgp_sym_decrypt(v_order.buyer_phone_encrypted, v_key), '\D', '', 'g');
  if v_stored_norm <> v_phone_norm then
    return null;   -- 전화 불일치 — 동일 응답
  end if;

  -- 항목 요약 (상품명 포함)
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name,
           'variant', v.name,
           'qty', i.qty,
           'unit_price', i.unit_price,
           'subtotal', i.subtotal
         ) order by i.id), '[]'::jsonb)
    into v_items
    from store_order_items i
    join store_variants v on v.id = i.variant_id
    join store_products p on p.id = v.product_id
   where i.order_id = v_order.id;

  -- 배송 정보 (있으면)
  select jsonb_build_object('carrier', s.carrier, 'tracking_no', s.tracking_no, 'shipped_at', s.shipped_at)
    into v_shipment
    from store_shipments s
   where s.order_id = v_order.id;

  return jsonb_build_object(
    'order_no', v_order.order_no,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'paid_at', v_order.paid_at,
    'expires_at', v_order.expires_at,
    'total_amount', v_order.total_amount,
    'items', v_items,
    'shipment', v_shipment   -- null 가능
  );
end;
$$;

revoke all on function public.lookup_store_order(text, text) from public;
grant execute on function public.lookup_store_order(text, text) to anon, authenticated;

-- ============================================================================
-- RPC 3) confirm_store_payment — 입금확인 (어드민 전용, 멱등)
--   · status 조건부 UPDATE(awaiting_payment→paid) — 0행이면 이미 처리(에러X)
--   · 같은 트랜잭션에서 재고 조건부 차감(stock_qty>=qty) — 실패 시 롤백
-- ============================================================================
create or replace function public.confirm_store_payment(
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
  v_item record;
  v_dec int;
  v_status text;
begin
  if not public.has_admin_role(array['super_admin','ops_admin']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- (1) 멱등 상태전이: awaiting_payment 인 건만 paid 로
  update store_orders
     set status = 'paid', paid_at = now(), paid_by = auth.uid()
   where id = p_order_id and status = 'awaiting_payment';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- 이미 처리됐거나 미존재 — 에러 대신 현재상태 반환(멱등)
    select status into v_status from store_orders where id = p_order_id;
    if v_status is null then
      raise exception 'order_not_found' using errcode = 'P0001';
    end if;
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_status);
  end if;

  -- (2) 재고 차감 (조건부 UPDATE — 음수 방지). 하나라도 실패하면 롤백.
  for v_item in
    select variant_id, sum(qty) as qty
    from store_order_items where order_id = p_order_id
    group by variant_id
  loop
    update store_variants
       set stock_qty = stock_qty - v_item.qty
     where id = v_item.variant_id and stock_qty >= v_item.qty;
    get diagnostics v_dec = row_count;
    if v_dec = 0 then
      raise exception 'insufficient_stock_at_confirm'
        using errcode = 'P0001',
              detail = 'variant_id=' || v_item.variant_id || ' qty=' || v_item.qty;
    end if;
  end loop;

  -- (3) 이벤트 로그 (actor = 어드민 uuid)
  insert into store_order_events (order_id, from_status, to_status, actor, note)
  values (p_order_id, 'awaiting_payment', 'paid', coalesce(auth.uid()::text, 'system'), 'payment_confirmed');

  return jsonb_build_object('ok', true, 'already_processed', false, 'status', 'paid', 'order_id', p_order_id);
end;
$$;

revoke all on function public.confirm_store_payment(uuid) from public, anon;
grant execute on function public.confirm_store_payment(uuid) to authenticated;

-- ============================================================================
-- RPC 4) rpc_admin_get_store_buyer_phone — 어드민 주문상세 전화 복호화
--   PRD §7: 어드민 복호화는 RPC 경유 + 감사로그. (0011 패턴 미러)
-- ============================================================================
create or replace function public.rpc_admin_get_store_buyer_phone(
  p_order_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_enc bytea;
  v_phone text;
begin
  if not public.has_admin_role(array['super_admin','ops_admin']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select buyer_phone_encrypted into v_enc from store_orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  v_phone := extensions.pgp_sym_decrypt(v_enc, public.pii_key());

  -- PII 접근 감사 (V1 audit_events 재사용)
  insert into audit_events (actor_type, actor_id, action, subject_type, subject_id, after_value)
  values ('admin', auth.uid(), 'pii.store_buyer_phone_decrypted', 'store_order', p_order_id,
          jsonb_build_object('reason', 'admin_order_detail'));

  return jsonb_build_object('ok', true, 'phone', v_phone, 'order_id', p_order_id);
end;
$$;

revoke all on function public.rpc_admin_get_store_buyer_phone(uuid) from public, anon;
grant execute on function public.rpc_admin_get_store_buyer_phone(uuid) to authenticated;
