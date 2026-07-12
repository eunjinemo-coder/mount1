'use server';

/**
 * A4 견적요청함 — 처리 상태 변경(new→contacted→closed) server action.
 * store_quote_requests RLS admin_all: super_admin/ops_admin/cs_admin.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@mount/db';
import { assertAdminRole, isValidUuid } from '@mount/lib';
import { storeClient } from '../_lib/shared';
import { STORE_QUOTE_ROLES } from '../_lib/labels';

const QUOTE_STATUSES = ['new', 'contacted', 'closed'] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface StoreQuoteActionResult {
  ok: boolean;
  error?: string;
}

export async function updateQuoteStatusAction(
  quoteId: string,
  nextStatus: string,
): Promise<StoreQuoteActionResult> {
  await assertAdminRole(STORE_QUOTE_ROLES);

  if (!isValidUuid(quoteId)) {
    return { ok: false, error: '잘못된 견적요청 ID 입니다.' };
  }
  if (!QUOTE_STATUSES.includes(nextStatus as QuoteStatus)) {
    return { ok: false, error: '잘못된 상태값입니다.' };
  }

  const client = storeClient(await getServerClient());
  const { error } = await client
    .from('store_quote_requests')
    .update({ status: nextStatus })
    .eq('id', quoteId);

  if (error) return { ok: false, error: '상태 변경에 실패했습니다.' };

  revalidatePath('/store/quotes');
  return { ok: true };
}
