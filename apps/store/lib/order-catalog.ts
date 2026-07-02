/**
 * 주문서(S3)용 카탈로그 — 변형·재고·구간단가.
 *
 * variant_id 는 seed(0022_store_dev_seed.sql)에서 gen_random_uuid() 로 생성되어
 * 비결정적이다 → 하드코딩 불가. 따라서 주문 제출에 쓸 실 variant_id 는 런타임에 DB 에서
 * 조회해야 한다. dev DB 에 아직 push 안 된 R3 시점엔 조회가 비므로 더미로 폴백하되,
 * 폴백은 variantId='' 이고 seeded=false → 폼 제출을 막는다(가짜 UUID 로 RPC 호출 방지).
 * push 후(R3.5) 자동으로 실 카탈로그가 잡히고 제출이 활성화된다.
 *
 * 공개 상세페이지(S2)는 지시대로 더미 유지. 이 파일은 주문 플로우 전용.
 *
 * ⚠️ 서버 전용 (storeTable → getStoreServerClient).
 */
import { captureMessage } from '@mount/lib';
import { getStoreServerClient } from './supabase';
import {
  storeTable,
  type StoreProductRow,
  type StoreVariantRow,
  type StorePriceTierRow,
} from './store-tables';
import { DUMMY_PRODUCTS, type DummyProduct } from './dummy-products';
import type { PriceTier } from './pricing';

export interface OrderVariant {
  variantId: string;
  name: string;
  sku: string;
  basePrice: number;
  stock: number;
  tiers: PriceTier[];
}

export interface OrderCatalog {
  slug: string;
  name: string;
  sizeRange: string;
  variants: OrderVariant[];
  /** true = 실 DB variant_id 확보(제출 가능). false = 더미 폴백(제출 비활성). */
  seeded: boolean;
}

/** slug → seed SKU (0022_store_dev_seed.sql). 더미 폴백 표시용. */
const SLUG_SKU: Record<string, string> = {
  'no-drill-bracket-standard': 'WP-BRKT-STD',
  'no-drill-bracket-pro': 'WP-BRKT-PRO',
};

function dummyToCatalog(product: DummyProduct): OrderCatalog {
  return {
    slug: product.slug,
    name: product.name,
    sizeRange: product.sizeRange,
    seeded: false,
    variants: [
      {
        variantId: '', // 미시딩 — 제출 차단 sentinel
        name: `${product.name} (${product.sizeRange})`,
        sku: SLUG_SKU[product.slug] ?? product.slug,
        basePrice: product.basePrice,
        stock: product.stock,
        tiers: product.priceTiers.map((t) => ({ minQty: t.minQty, unitPrice: t.unitPrice })),
      },
    ],
  };
}

/**
 * 주문 카탈로그 조회.
 *   1) DB(store_products/variants/tiers) 조회 — published/active 공개 RLS.
 *   2) 성공+변형 존재 → 실 카탈로그(seeded=true).
 *   3) 미존재/오류(pre-push 포함) → 더미 폴백(seeded=false).
 * 반환 null = 그 slug 자체가 없음(더미에도 없음) → 404.
 */
export async function getOrderCatalog(slug: string): Promise<OrderCatalog | null> {
  const dummy = DUMMY_PRODUCTS.find((p) => p.slug === slug);

  try {
    const supabase = await getStoreServerClient();
    const { data: product, error: pErr } = await storeTable<StoreProductRow>(
      supabase,
      'store_products',
    )
      .select('id,slug,name,subtitle')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (pErr || !product) throw pErr ?? new Error('product_not_found');

    const { data: variants, error: vErr } = await storeTable<StoreVariantRow>(
      supabase,
      'store_variants',
    )
      .select('id,name,sku,base_price,stock_qty')
      .eq('product_id', product.id)
      .eq('active', true)
      .order('base_price', { ascending: true });

    if (vErr || !variants || variants.length === 0) throw vErr ?? new Error('no_variants');

    const variantIds = variants.map((v) => v.id);
    const { data: tiers } = await storeTable<StorePriceTierRow>(supabase, 'store_price_tiers')
      .select('variant_id,min_qty,unit_price')
      .in('variant_id', variantIds);

    const tiersByVariant = new Map<string, PriceTier[]>();
    for (const t of tiers ?? []) {
      const list = tiersByVariant.get(t.variant_id) ?? [];
      list.push({ minQty: t.min_qty, unitPrice: t.unit_price });
      tiersByVariant.set(t.variant_id, list);
    }

    return {
      slug: product.slug,
      name: product.name,
      sizeRange: product.subtitle ?? dummy?.sizeRange ?? '',
      seeded: true,
      variants: variants.map((v) => ({
        variantId: v.id,
        name: v.name,
        sku: v.sku,
        basePrice: v.base_price,
        stock: v.stock_qty,
        tiers: (tiersByVariant.get(v.id) ?? []).sort((a, b) => a.minQty - b.minQty),
      })),
    };
  } catch (err) {
    // pre-push / DB 미가용 — 더미 폴백 (있을 때만).
    // dev(pre-push)에선 항상 throw 되므로 Sentry 노이즈 방지 위해 prod에서만 관측.
    // R3.5 이후 운영 중 RLS 오류·DB 장애가 조용히 더미 가격을 노출하는 것을 잡기 위함.
    if (process.env.NODE_ENV === 'production') {
      captureMessage(
        `getOrderCatalog 폴백(더미) — DB 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
        'error',
        { slug },
      );
    }
    return dummy ? dummyToCatalog(dummy) : null;
  }
}
