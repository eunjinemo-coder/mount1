'use server';

import { callRpc, getServerClient } from '@mount/db';
import { assertTechnicianSession, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export interface ScheduleEditResult {
  ok: boolean;
  error?: string;
  newAt?: string;
}

export async function updateScheduleAction(args: {
  orderId: string;
  newScheduledAt: string; // ISO datetime
}): Promise<ScheduleEditResult> {
  await assertTechnicianSession();

  if (!isValidUuid(args.orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }
  const newAt = new Date(args.newScheduledAt);
  if (isNaN(newAt.getTime())) {
    return { ok: false, error: '잘못된 날짜 형식입니다.' };
  }

  const supabase = await getServerClient();
  const { data, error } = await callRpc<{ ok: boolean; new_at?: string }>(
    supabase,
    'update_schedule_by_technician',
    {
      p_order_id: args.orderId,
      p_new_scheduled_at: newAt.toISOString(),
    },
  );

  if (error) {
    const msg = error.message || '';
    if (msg.includes('window_closed')) {
      return {
        ok: false,
        error: '시작 1시간 이내에는 변경할 수 없습니다. 본사 카카오톡 채널로 문의해 주세요.',
      };
    }
    if (msg.includes('past_time')) {
      return { ok: false, error: '과거 시각으로는 변경할 수 없습니다.' };
    }
    if (msg.includes('forbidden') || msg.includes('unauthorized')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    if (msg.includes('invalid_status')) {
      return { ok: false, error: '현재 상태에서는 변경할 수 없습니다.' };
    }
    if (msg.includes('order_not_found')) {
      return { ok: false, error: '주문을 찾을 수 없습니다.' };
    }
    return { ok: false, error: '시각 변경 중 문제가 발생했어요.' };
  }

  revalidatePath(`/order/${args.orderId}`);
  revalidatePath('/today');

  return { ok: true, newAt: data?.new_at };
}

/** 같은 기사 ±2h 시공 충돌 fetch — 모달이 호출 */
export async function fetchScheduleConflicts(args: {
  orderId: string;
  newScheduledAt: string;
}): Promise<{ count: number }> {
  await assertTechnicianSession();
  const supabase = await getServerClient();
  const newAt = new Date(args.newScheduledAt);
  const lo = new Date(newAt.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const hi = new Date(newAt.getTime() + 2 * 60 * 60 * 1000).toISOString();

  // technician_id() helper used inside RLS — fetch own orders only
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .neq('id', args.orderId)
    .in('status', ['assigned'])
    .gte('scheduled_installation_at', lo)
    .lte('scheduled_installation_at', hi);

  if (error || !data) return { count: 0 };
  return { count: data.length };
}
