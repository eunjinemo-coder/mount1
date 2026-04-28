-- ============================================================================
-- 0015_dev_seed.sql — Dev 환경 더미 데이터 (운영 전 기능 테스트용)
-- ⚠️ prod 적용 금지 — DO NOT push to rydmceypkospgzhvfpyx
--
-- 데이터 구성:
--   · 5 customers (서울/경기, 다양한 지역)
--   · 12 orders (status 분포: 미배차 4 / 배차 3 / 시공 2 / 완료 2 / 취소 1)
--   · 미배차 주문은 dispatch 추천 알고리즘 검증용
--
-- bytea 컬럼 (name_encrypted, phone_encrypted 등) 은 placeholder 값.
-- Vault pii_key 등록 시 encrypt_pii() 로 교체 가능. 현재는 list/UI 표시만 검증.
-- ============================================================================

-- 멱등 보장 — 이미 seed 적용됐으면 skip
do $$
declare
  seed_marker uuid;
begin
  select id into seed_marker
    from customers
   where coupang_customer_id = 'SEED_MARKER_DEV';

  if seed_marker is not null then
    raise notice 'seed already applied — skip';
    return;
  end if;

  -- ============================================================================
  -- (1) customers (5명)
  -- ============================================================================
  insert into customers (id, name_encrypted, phone_encrypted, phone_tail4,
    address_road_encrypted, address_detail_encrypted,
    address_region_sido, address_region_sigungu,
    address_lat, address_lng, coupang_customer_id, pii_retained_until)
  values
    -- 서울 강남 (가까움)
    ('11111111-1111-1111-1111-111111111111',
     '\x00'::bytea, '\x00'::bytea, '1234',
     '\x00'::bytea, '\x00'::bytea,
     '서울특별시', '강남구',
     37.5172, 127.0473, 'CPNG_DEV_001', '2027-04-28'),
    -- 서울 서초
    ('22222222-2222-2222-2222-222222222222',
     '\x00'::bytea, '\x00'::bytea, '2345',
     '\x00'::bytea, '\x00'::bytea,
     '서울특별시', '서초구',
     37.4837, 127.0324, 'CPNG_DEV_002', '2027-04-28'),
    -- 경기 성남
    ('33333333-3333-3333-3333-333333333333',
     '\x00'::bytea, '\x00'::bytea, '3456',
     '\x00'::bytea, '\x00'::bytea,
     '경기도', '성남시 분당구',
     37.3811, 127.1192, 'CPNG_DEV_003', '2027-04-28'),
    -- 경기 수원
    ('44444444-4444-4444-4444-444444444444',
     '\x00'::bytea, '\x00'::bytea, '4567',
     '\x00'::bytea, '\x00'::bytea,
     '경기도', '수원시 영통구',
     37.2587, 127.0648, 'CPNG_DEV_004', '2027-04-28'),
    -- seed marker 겸 인천
    ('55555555-5555-5555-5555-555555555555',
     '\x00'::bytea, '\x00'::bytea, '5678',
     '\x00'::bytea, '\x00'::bytea,
     '인천광역시', '연수구',
     37.4101, 126.6783, 'SEED_MARKER_DEV', '2027-04-28');

  -- ============================================================================
  -- (2) orders (12건) — status 분포 다양화
  -- ============================================================================

  -- 미배차 4건 (dispatch 추천 알고리즘 검증용)
  insert into orders (id, coupang_order_id, order_received_at, customer_id,
    tv_brand, tv_model, tv_size_inch,
    option_selected, price_option_b, price_option_c, price_paid_by_customer_to_coupang,
    requested_install_date, scheduled_installation_at,
    status)
  values
    ('aaaaaaa1-1111-1111-1111-111111111111',
     'DEV-ORDER-001', now() - interval '2 days',
     '11111111-1111-1111-1111-111111111111',
     '삼성', 'KQ65QN90D', 65,
     'C_no_drill', 200000, 250000, 250000,
     current_date + 1, (current_date + 1)::timestamptz + interval '10 hours',
     'scheduled'),
    ('aaaaaaa2-2222-2222-2222-222222222222',
     'DEV-ORDER-002', now() - interval '1 day',
     '22222222-2222-2222-2222-222222222222',
     'LG', 'OLED55C3', 55,
     'C_no_drill', 200000, 250000, 250000,
     current_date + 1, (current_date + 1)::timestamptz + interval '14 hours',
     'scheduled'),
    ('aaaaaaa3-3333-3333-3333-333333333333',
     'DEV-ORDER-003', now() - interval '6 hours',
     '33333333-3333-3333-3333-333333333333',
     '삼성', 'QN75Q70D', 75,
     'B_drill', 250000, 300000, 300000,
     current_date + 2, (current_date + 2)::timestamptz + interval '11 hours',
     'happy_call_done'),
    ('aaaaaaa4-4444-4444-4444-444444444444',
     'DEV-ORDER-004', now() - interval '4 hours',
     '44444444-4444-4444-4444-444444444444',
     'LG', 'UHD43UR8050', 43,
     'A_stand', 80000, 80000, 80000,
     current_date + 2, null,
     'received');

  -- 배차 완료 3건 (super_admin 본인에게 배차 — eunjin technician 매핑이 없으므로 첫번째 active tech)
  -- 동적 lookup: 첫 active tech 가져오기
  declare
    v_tech1 uuid;
  begin
    select id into v_tech1 from technicians where status = 'active' order by created_at limit 1;
    -- 활성 tech 없을 시 patch 안 함
    if v_tech1 is not null then
      insert into orders (id, coupang_order_id, order_received_at, customer_id,
        tv_brand, tv_model, tv_size_inch,
        option_selected, price_option_b, price_option_c, price_paid_by_customer_to_coupang,
        requested_install_date, scheduled_installation_at,
        status, assigned_technician_id, assigned_at)
      values
        -- 배차됨 (이동 전)
        ('bbbbbbb1-1111-1111-1111-111111111111',
         'DEV-ORDER-005', now() - interval '1 day',
         '55555555-5555-5555-5555-555555555555',
         'LG', 'OLED65C3', 65,
         'C_no_drill', 200000, 250000, 250000,
         current_date, (current_date)::timestamptz + interval '10 hours',
         'assigned', v_tech1, now() - interval '2 hours'),
        -- 이동 중
        ('bbbbbbb2-2222-2222-2222-222222222222',
         'DEV-ORDER-006', now() - interval '1 day',
         '11111111-1111-1111-1111-111111111111',
         '삼성', 'QN85Q60D', 85,
         'B_drill', 280000, 350000, 350000,
         current_date, (current_date)::timestamptz + interval '13 hours',
         'en_route', v_tech1, now() - interval '3 hours'),
        -- 시공 중
        ('bbbbbbb3-3333-3333-3333-333333333333',
         'DEV-ORDER-007', now() - interval '2 days',
         '22222222-2222-2222-2222-222222222222',
         'LG', 'OLED77G3', 77,
         'C_no_drill', 220000, 270000, 270000,
         current_date, (current_date)::timestamptz + interval '15 hours',
         'in_progress', v_tech1, now() - interval '6 hours');

      -- installations row 도 함께
      insert into installations (order_id, technician_id, departed_at, arrived_at, started_at)
      values
        ('bbbbbbb1-1111-1111-1111-111111111111', v_tech1, null, null, null),
        ('bbbbbbb2-2222-2222-2222-222222222222', v_tech1,
         now() - interval '30 minutes', null, null),
        ('bbbbbbb3-3333-3333-3333-333333333333', v_tech1,
         now() - interval '4 hours', now() - interval '3 hours', now() - interval '2 hours');
    end if;
  end;

  -- 완료 2건 + 취소 1건 (날짜 지난 것)
  declare
    v_tech1 uuid;
  begin
    select id into v_tech1 from technicians where status = 'active' order by created_at limit 1;
    if v_tech1 is not null then
      insert into orders (id, coupang_order_id, order_received_at, customer_id,
        tv_brand, tv_model, tv_size_inch,
        option_selected, price_option_b, price_option_c, price_paid_by_customer_to_coupang,
        requested_install_date, scheduled_installation_at, status,
        assigned_technician_id, assigned_at, status_changed_at,
        coupang_paid_at)
      values
        -- 무타공 완료 (어제)
        ('ccccccc1-1111-1111-1111-111111111111',
         'DEV-ORDER-008', now() - interval '3 days',
         '33333333-3333-3333-3333-333333333333',
         '삼성', 'KU65DU8000', 65,
         'C_no_drill', 200000, 250000, 250000,
         current_date - 1, (current_date - 1)::timestamptz + interval '11 hours',
         'no_drill_completed', v_tech1, now() - interval '2 days', now() - interval '1 day',
         now() - interval '5 days'),
        -- 타공 전환 완료 + paid
        ('ccccccc2-2222-2222-2222-222222222222',
         'DEV-ORDER-009', now() - interval '4 days',
         '44444444-4444-4444-4444-444444444444',
         'LG', 'OLED55B3', 55,
         'C_no_drill', 200000, 250000, 250000,
         current_date - 2, (current_date - 2)::timestamptz + interval '14 hours',
         'paid', v_tech1, now() - interval '3 days', now() - interval '2 days',
         now() - interval '6 days'),
        -- 취소 요청
        ('ccccccc3-3333-3333-3333-333333333333',
         'DEV-ORDER-010', now() - interval '5 days',
         '55555555-5555-5555-5555-555555555555',
         '삼성', 'QN98Q90C', 98,
         'C_no_drill', 350000, 450000, 450000,
         current_date - 3, (current_date - 3)::timestamptz + interval '10 hours',
         'cancel_requested', v_tech1, now() - interval '4 days', now() - interval '3 days', null);

      -- 완료된 건의 installations
      insert into installations (order_id, technician_id, departed_at, arrived_at, started_at, completed_at, result_type)
      values
        ('ccccccc1-1111-1111-1111-111111111111', v_tech1,
         (current_date - 1)::timestamptz + interval '10 hours',
         (current_date - 1)::timestamptz + interval '11 hours',
         (current_date - 1)::timestamptz + interval '11 hours' + interval '10 minutes',
         (current_date - 1)::timestamptz + interval '12 hours',
         'no_drill_success'),
        ('ccccccc2-2222-2222-2222-222222222222', v_tech1,
         (current_date - 2)::timestamptz + interval '13 hours',
         (current_date - 2)::timestamptz + interval '14 hours',
         (current_date - 2)::timestamptz + interval '14 hours' + interval '15 minutes',
         (current_date - 2)::timestamptz + interval '15 hours',
         'drill_converted'),
        ('ccccccc3-3333-3333-3333-333333333333', v_tech1,
         (current_date - 3)::timestamptz + interval '9 hours',
         (current_date - 3)::timestamptz + interval '10 hours', null, null,
         'cancelled');

      -- 전환 케이스에 conversion 메타
      update orders
         set conversion_from_no_drill = true,
             conversion_difference_amount = 50000,
             conversion_agreed_method = 'verbal',
             conversion_agreed_at = (current_date - 2)::timestamptz + interval '14 hours' + interval '5 minutes',
             status = 'drill_converted_completed'
       where id = 'ccccccc2-2222-2222-2222-222222222222';

      -- 취소 리포트 1건
      insert into cancellation_reports (order_id, technician_id, category_primary,
        situation_note, signature_image_url)
      values
        ('ccccccc3-3333-3333-3333-333333333333', v_tech1,
         'no_drill_structural',
         '벽 두께 80mm 미만 + 콘크리트 공동 영역 발견 — 무타공 시공 시 안전 보장 불가. 고객에게 타공 전환 권유했으나 거부.',
         'placeholder://signature-pending');
    end if;
  end;

  raise notice 'seed completed — 5 customers + 12 orders inserted';
end $$;
