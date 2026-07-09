'use server';

import { getServerClient } from '@mount/db';
import { assertAdminRole, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';
import { enqueueSheetSync } from '@/lib/sheets/enqueue';

/**
 * Order status state machine — 정상 전이만 허용 (super_admin 은 force override 가능).
 *
 * P0 (architect 점검): 18 status 무차별 허용 → closed → received 같은 역전 가능했음.
 * 본 그래프는 운영 의도된 전이만 명세. force_override=true 시에만 우회.
 */
const TRANSITIONS: Record<string, readonly string[]> = {
  received: ['happy_call_pending', 'happy_call_done', 'scheduled', 'assigned', 'on_hold', 'cancel_requested'],
  happy_call_pending: ['happy_call_done', 'on_hold', 'cancel_requested'],
  happy_call_done: ['scheduled', 'assigned', 'postponed', 'on_hold', 'cancel_requested'],
  scheduled: ['assigned', 'postponed', 'on_hold', 'cancel_requested'],
  assigned: ['scheduled', 'en_route', 'postponed', 'on_hold', 'cancel_requested'],
  en_route: ['on_site', 'postponed', 'cancel_requested'],
  on_site: ['in_progress', 'cancel_requested'],
  in_progress: ['no_drill_completed', 'drill_converted_completed', 'cancel_requested'],
  no_drill_completed: ['awaiting_payment', 'paid', 'closed'],
  drill_converted_completed: ['awaiting_payment'],
  awaiting_payment: ['payment_sent', 'paid', 'on_hold'],
  payment_sent: ['paid', 'awaiting_payment', 'on_hold'],
  paid: ['closed'],
  postponed: ['scheduled', 'assigned', 'cancel_requested'],
  on_hold: ['received', 'happy_call_done', 'scheduled', 'assigned'],
  cancel_requested: ['cancel_confirmed_coupang_transfer', 'scheduled'],
  cancel_confirmed_coupang_transfer: ['closed'],
  closed: [],
};

const ALLOWED_STATUSES = Object.keys(TRANSITIONS);
const MUTATION_ROLES = ['super_admin', 'cs_admin', 'dispatch_admin'] as const;

export interface OrderMutationResult {
  ok: boolean;
  error?: string;
}

function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateOrderStatusAction(
  id: string,
  status: string,
  reason?: string,
  forceOverride = false,
): Promise<OrderMutationResult> {
  // P0 — 권한 검증 (helper 통합)
  const session = await assertAdminRole(MUTATION_ROLES);

  if (!isValidUuid(id)) return { ok: false, error: '잘못된 주문 ID' };
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, error: '상태 값 오류' };

  const client = await getServerClient();

  // P0-1 — 현재 status 확인 + transition graph 검증
  const { data: current } = await client
    .from('orders')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (!current) return { ok: false, error: '주문을 찾을 수 없습니다.' };

  const currentStatus = (current as { status: string | null }).status ?? '';

  // force override 는 super_admin 만 + reason 필수
  const forced = forceOverride && session.adminRole === 'super_admin';
  if (!forced && !canTransition(currentStatus, status)) {
    return {
      ok: false,
      error: `허용되지 않는 상태 전이입니다 (${currentStatus} → ${status})`,
    };
  }
  if (forced && (!reason || reason.trim().length < 5)) {
    return { ok: false, error: '강제 변경 시 사유 5자 이상 필수' };
  }

  // optimistic lock — currentStatus 와 일치할 때만 update (race 차단)
  const { error, data: updated } = await client
    .from('orders')
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', currentStatus)
    .select('id');

  if (error) return { ok: false, error: '상태 변경 실패' };
  if (!updated || updated.length === 0) {
    return { ok: false, error: '다른 사용자가 먼저 상태를 변경했어요. 새로고침 후 다시 시도해 주세요.' };
  }

  // P1-2 — actor_id 보강 (감사 추적)
  const { error: auditError } = await client.from('audit_events').insert({
    actor_type: 'admin',
    actor_id: session.userId,
    action: 'order.status_manual_override',
    subject_type: 'order',
    subject_id: id,
    after_value: { status, from: currentStatus, reason: reason ?? null, forced },
  });
  if (auditError) {
    console.error('[updateOrderStatus] audit_events insert failed:', auditError);
  }

  // 앱→시트 동기화 큐잉 (best-effort · 트랜잭션 밖 · 실패해도 주문변경 유지)
  await enqueueSheetSync(id);

  revalidatePath(`/orders/${id}`);
  revalidatePath('/orders');
  revalidatePath('/today');
  return { ok: true };
}

export async function updateOrderScheduleAction(
  id: string,
  scheduledAt: string | null,
): Promise<OrderMutationResult> {
  const session = await assertAdminRole(MUTATION_ROLES);

  if (!isValidUuid(id)) return { ok: false, error: '잘못된 주문 ID' };

  if (scheduledAt !== null) {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: '시각 형식 오류' };
  }

  const client = await getServerClient();
  const { error } = await client
    .from('orders')
    .update({ scheduled_installation_at: scheduledAt })
    .eq('id', id);

  if (error) return { ok: false, error: '시각 변경 실패' };

  const { error: auditError } = await client.from('audit_events').insert({
    actor_type: 'admin',
    actor_id: session.userId,
    action: 'order.schedule_manual_change',
    subject_type: 'order',
    subject_id: id,
    after_value: { scheduled_installation_at: scheduledAt },
  });
  if (auditError) {
    console.error('[updateOrderSchedule] audit_events insert failed:', auditError);
  }

  // 앱→시트 동기화 큐잉 (best-effort)
  await enqueueSheetSync(id);

  revalidatePath(`/orders/${id}`);
  revalidatePath('/orders');
  return { ok: true };
}
