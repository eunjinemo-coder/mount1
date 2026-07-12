-- ============================================================================
-- 0022_store_dev_seed.sql — 스토어 Dev 더미 데이터 (기능 테스트용)
-- ⚠️ prod 적용 금지 — DO NOT push to rydmceypkospgzhvfpyx
-- Source: 02_PRD_P0_STORE.md §2 (스키마) · 오케스트레이터 지정 더미 2종
--
-- 구성: 2 상품(각 1 변형 + 2 수량구간 tier), 모두 status='published'.
--   1) no-drill-bracket-standard : 89,000 / 10↑ 79,000 / 50↑ 69,000
--   2) no-drill-bracket-pro      : 129,000 / 10↑ 115,000 / 50↑ 99,000
-- content 는 hero/spec/faq 최소 섹션 스텁(더미 한글 카피).
--
-- 멱등: slug 존재 시 전체 skip. (0015_dev_seed.sql 컨벤션 준용)
-- ============================================================================

do $$
declare
  v_prod_std uuid;
  v_prod_pro uuid;
  v_var_std uuid;
  v_var_pro uuid;
begin
  -- 이미 seed 적용됐으면 skip
  if exists (select 1 from store_products where slug = 'no-drill-bracket-standard') then
    raise notice 'store seed already applied — skip';
    return;
  end if;

  -- ==========================================================================
  -- (1) 무타공 브라켓 스탠다드
  -- ==========================================================================
  insert into store_products (slug, name, subtitle, images, status, sort, content)
  values (
    'no-drill-bracket-standard',
    '벽걸이프로 무타공 브라켓 스탠다드',
    '32~55인치 TV용',
    array['/placeholder/bracket-standard.svg'],
    'published',
    10,
    jsonb_build_array(
      jsonb_build_object('type', 'hero',
        'title', '벽에 구멍 없이, 튼튼하게',
        'subtitle', '32~55인치 TV를 위한 무타공 벽걸이 브라켓',
        'image', '/placeholder/bracket-standard.svg'),
      jsonb_build_object('type', 'spec',
        'title', '제품 사양',
        'rows', jsonb_build_array(
          jsonb_build_object('label', '호환 인치', 'value', '32~55인치'),
          jsonb_build_object('label', '최대 하중', 'value', '35kg'),
          jsonb_build_object('label', 'VESA', 'value', '최대 400x400'),
          jsonb_build_object('label', '설치 방식', 'value', '무타공(접착식 앵커)'))),
      jsonb_build_object('type', 'faq',
        'title', '자주 묻는 질문',
        'items', jsonb_build_array(
          jsonb_build_object('q', '정말 벽에 구멍을 안 뚫나요?',
            'a', '네, 전용 무타공 앵커로 석고보드·콘크리트 벽 모두 시공 가능합니다.'),
          jsonb_build_object('q', '설치가 어렵지 않나요?',
            'a', '동봉된 가이드와 수평계로 누구나 30분 내 설치할 수 있습니다.')))
    )
  )
  returning id into v_prod_std;

  insert into store_variants (product_id, name, sku, base_price, stock_qty, active)
  values (v_prod_std, '스탠다드 (32~55인치)', 'WP-BRKT-STD', 89000, 100, true)
  returning id into v_var_std;

  insert into store_price_tiers (variant_id, min_qty, unit_price) values
    (v_var_std, 10, 79000),
    (v_var_std, 50, 69000);

  -- ==========================================================================
  -- (2) 무타공 브라켓 프로
  -- ==========================================================================
  insert into store_products (slug, name, subtitle, images, status, sort, content)
  values (
    'no-drill-bracket-pro',
    '벽걸이프로 무타공 브라켓 프로',
    '55~85인치 대형 TV용',
    array['/placeholder/bracket-pro.svg'],
    'published',
    20,
    jsonb_build_array(
      jsonb_build_object('type', 'hero',
        'title', '대형 TV도 무타공으로',
        'subtitle', '55~85인치 대형 TV를 위한 강화 무타공 브라켓',
        'image', '/placeholder/bracket-pro.svg'),
      jsonb_build_object('type', 'spec',
        'title', '제품 사양',
        'rows', jsonb_build_array(
          jsonb_build_object('label', '호환 인치', 'value', '55~85인치'),
          jsonb_build_object('label', '최대 하중', 'value', '60kg'),
          jsonb_build_object('label', 'VESA', 'value', '최대 600x400'),
          jsonb_build_object('label', '설치 방식', 'value', '무타공(강화 앵커 4점 지지)'))),
      jsonb_build_object('type', 'faq',
        'title', '자주 묻는 질문',
        'items', jsonb_build_array(
          jsonb_build_object('q', '75인치도 안전한가요?',
            'a', '4점 지지 구조로 최대 60kg까지 안전하게 지지합니다.'),
          jsonb_build_object('q', '대량 구매 할인이 있나요?',
            'a', '10개 이상 구매 시 자동으로 도매가가 적용됩니다.')))
    )
  )
  returning id into v_prod_pro;

  insert into store_variants (product_id, name, sku, base_price, stock_qty, active)
  values (v_prod_pro, '프로 (55~85인치)', 'WP-BRKT-PRO', 129000, 100, true)
  returning id into v_var_pro;

  insert into store_price_tiers (variant_id, min_qty, unit_price) values
    (v_var_pro, 10, 115000),
    (v_var_pro, 50, 99000);

  raise notice 'store seed completed — 2 products + 2 variants + 4 tiers inserted';
end $$;
