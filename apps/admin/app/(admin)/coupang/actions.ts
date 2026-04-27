'use server';

import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MarkTransferResult {
  ok: boolean;
  successCount?: number;
  error?: string;
}

/**
 * 선택한 취소 리포트들을 'transferred_manually' 로 일괄 마킹.
 * 본사 운영자가 쿠팡 측 (이메일/팩스/카카오 채널) 에 수기 전달 후 호출.
 */
export async function markTransferredAction(
  reportIds: string[],
  mode: 'transferred_manually' | 'included_in_daily' | 'included_in_weekly',
): Promise<MarkTransferResult> {
  const session = await getSession();
  if (!session?.adminRole || !['super_admin', 'cs_admin', 'ops_admin'].includes(session.adminRole)) {
    throw new ForbiddenError('insufficient_admin_role');
  }

  const validIds = reportIds.filter((id) => UUID_RE.test(id));
  if (validIds.length === 0) {
    return { ok: false, error: '유효한 항목이 없습니다.' };
  }

  const client = await getServerClient();
  const { error, count } = await client
    .from('cancellation_reports')
    .update({
      coupang_transfer_status: mode,
      coupang_transfer_at: new Date().toISOString(),
    }, { count: 'exact' })
    .in('id', validIds)
    .eq('coupang_transfer_status', 'pending');

  if (error) {
    return { ok: false, error: '마킹에 실패했어요.' };
  }

  revalidatePath('/coupang');
  return { ok: true, successCount: count ?? 0 };
}
