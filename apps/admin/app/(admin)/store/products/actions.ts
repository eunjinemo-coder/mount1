'use server';

/**
 * A1 상품 관리 — 상태 토글(published/hidden) · 재고 수정 server actions.
 *
 * 팀리드 지시(R4b 스코프): 전체 편집폼은 TODO(R5) — 이 액션들이 지원하는 쓰기는
 * "상태 토글"과 "변형 재고 수정" 두 가지뿐이다. store_products/variants 는 0021 RLS
 * 상 super_admin/ops_admin 만 admin_all(전체 CRUD) — assertAdminRole 로 동일하게 가드.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@mount/db';
import { assertAdminRole } from '@mount/lib';
import { storeClient } from '../_lib/shared';
import { STORE_OPS_ROLES } from '../_lib/labels';

export interface StoreProductActionResult {
  ok: boolean;
  error?: string;
}

export async function toggleStoreProductStatusAction(
  productId: string,
  nextStatus: 'published' | 'hidden',
): Promise<StoreProductActionResult> {
  await assertAdminRole(STORE_OPS_ROLES);

  if (nextStatus !== 'published' && nextStatus !== 'hidden') {
    return { ok: false, error: '잘못된 상태값입니다.' };
  }

  const client = storeClient(await getServerClient());
  const { error } = await client
    .from('store_products')
    .update({ status: nextStatus })
    .eq('id', productId);

  if (error) return { ok: false, error: '상태 변경에 실패했습니다.' };

  revalidatePath('/store/products');
  revalidatePath(`/store/products/${productId}`);
  return { ok: true };
}

export async function updateStoreVariantStockAction(
  variantId: string,
  productId: string,
  stockQty: number,
): Promise<StoreProductActionResult> {
  await assertAdminRole(STORE_OPS_ROLES);

  if (!Number.isInteger(stockQty) || stockQty < 0) {
    return { ok: false, error: '재고 수량은 0 이상의 정수여야 합니다.' };
  }

  const client = storeClient(await getServerClient());
  const { error } = await client
    .from('store_variants')
    .update({ stock_qty: stockQty })
    .eq('id', variantId);

  if (error) return { ok: false, error: '재고 수정에 실패했습니다.' };

  revalidatePath('/store/products');
  revalidatePath(`/store/products/${productId}`);
  return { ok: true };
}
