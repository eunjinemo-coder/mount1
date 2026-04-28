'use server';

import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = [
  'received',
  'happy_call_pending',
  'happy_call_done',
  'scheduled',
  'assigned',
  'en_route',
  'on_site',
  'in_progress',
  'no_drill_completed',
  'drill_converted_completed',
  'awaiting_payment',
  'payment_sent',
  'paid',
  'postponed',
  'on_hold',
  'cancel_requested',
  'cancel_confirmed_coupang_transfer',
  'closed',
];

const MUTATION_ROLES = ['super_admin', 'cs_admin', 'dispatch_admin'];

export interface OrderMutationResult {
  ok: boolean;
  error?: string;
}

async function assertMutationRole(): Promise<void> {
  const session = await getSession();
  if (!session?.adminRole || !MUTATION_ROLES.includes(session.adminRole)) {
    throw new ForbiddenError('insufficient_role');
  }
}

export async function updateOrderStatusAction(
  id: string,
  status: string,
  reason?: string,
): Promise<OrderMutationResult> {
  await assertMutationRole();
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 주문 ID' };
  if (!ALLOWED_STATUSES.includes(status)) return { ok: false, error: '상태 값 오류' };

  const client = await getServerClient();
  const { error } = await client
    .from('orders')
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: '상태 변경 실패' };

  // 감사 로그
  await client.from('audit_events').insert({
    actor_type: 'admin',
    action: 'order.status_manual_override',
    subject_type: 'order',
    subject_id: id,
    after_value: { status, reason: reason ?? null },
  });

  revalidatePath(`/orders/${id}`);
  revalidatePath('/orders');
  return { ok: true };
}

export async function updateOrderScheduleAction(
  id: string,
  scheduledAt: string | null,
): Promise<OrderMutationResult> {
  await assertMutationRole();
  if (!UUID_RE.test(id)) return { ok: false, error: '잘못된 주문 ID' };

  // ISO 8601 검증 또는 null
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

  await client.from('audit_events').insert({
    actor_type: 'admin',
    action: 'order.schedule_manual_change',
    subject_type: 'order',
    subject_id: id,
    after_value: { scheduled_installation_at: scheduledAt },
  });

  revalidatePath(`/orders/${id}`);
  revalidatePath('/orders');
  return { ok: true };
}
