'use server';

import { callRpc, getServerClient } from '@mount/db';
import { assertTechnicianSession, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export interface CompleteResult {
  ok: boolean;
  error?: string;
  newStatus?: string;
}

interface AtomicPayload {
  ok: boolean;
  new_status?: string;
}

export async function completeInstallationAction(args: {
  orderId: string;
  optionSelected: 'B_drill' | 'C_no_drill';
  conversion: boolean;
  consentConfirmed: boolean;
  memo?: string;
}): Promise<CompleteResult> {
  // セッションガード
  await assertTechnicianSession();

  if (!isValidUuid(args.orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }
  if (!['B_drill', 'C_no_drill'].includes(args.optionSelected)) {
    return { ok: false, error: '잘못된 시공 옵션입니다.' };
  }

  const supabase = await getServerClient();

  // Pre-fetch photo counts server-side (RLS filtered — technician only sees own photos)
  const { data: photos } = await supabase
    .from('photos')
    .select('slot')
    .eq('order_id', args.orderId);

  const preCount = (photos ?? []).filter((p) =>
    ['pre_tv_screen', 'pre_wall'].includes(p.slot),
  ).length;
  const postCount = (photos ?? []).filter((p) =>
    ['post_front', 'post_left', 'post_right'].includes(p.slot),
  ).length;

  const { data, error } = await callRpc<AtomicPayload>(supabase, 'complete_install_atomic', {
    p_order_id: args.orderId,
    p_option_selected: args.optionSelected,
    p_conversion: args.conversion,
    p_consent_confirmed: args.consentConfirmed,
    p_memo: args.memo ?? '',
    p_photo_pre_count: preCount,
    p_photo_post_count: postCount,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('unauthorized') || msg.includes('forbidden')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    if (msg.includes('invalid_status')) {
      return { ok: false, error: '현재 상태에서는 완료할 수 없어요.' };
    }
    if (msg.includes('order_not_found')) {
      return { ok: false, error: '주문을 찾을 수 없습니다.' };
    }
    if (msg.includes('invalid_option')) {
      return { ok: false, error: '잘못된 시공 옵션입니다.' };
    }
    return { ok: false, error: '완료 처리 중 문제가 발생했어요.' };
  }

  revalidatePath(`/order/${args.orderId}`);
  revalidatePath('/today');

  const payload = data as AtomicPayload | null;
  return {
    ok: Boolean(payload?.ok),
    newStatus: payload?.new_status,
  };
}
