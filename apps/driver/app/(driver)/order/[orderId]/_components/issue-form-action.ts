'use server';

import { getServerClient } from '@mount/db';
import { assertTechnicianSession, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export interface IssueFormResult {
  ok: boolean;
  error?: string;
}

const VALID_CATEGORIES = [
  'no_drill_impossible',
  'customer_absent',
  'address_inaccessible',
  'tv_model_mismatch',
  'wall_damage_found',
  'etc',
] as const;

export async function createIssueAction(args: {
  orderId: string;
  category: string;
  note: string;
}): Promise<IssueFormResult> {
  const session = await assertTechnicianSession();
  if (!isValidUuid(args.orderId)) return { ok: false, error: '잘못된 주문 ID' };
  if (!VALID_CATEGORIES.includes(args.category as never)) {
    return { ok: false, error: '카테고리 선택' };
  }
  if (!args.note.trim()) return { ok: false, error: '메모를 입력해 주세요.' };

  const supabase = await getServerClient();
  const { error } = await supabase.from('issues').insert({
    order_id: args.orderId,
    technician_id: session.technicianId,
    category: args.category,
    note: args.note.trim(),
  });
  if (error) {
    if (error.message.includes('row-level security')) {
      return { ok: false, error: '권한 없음 — 본인 배차건만 이슈 보고 가능' };
    }
    return { ok: false, error: '이슈 보고 실패: ' + error.message };
  }
  revalidatePath(`/order/${args.orderId}`);
  return { ok: true };
}
