'use server';

import { getServerClient } from '@mount/db';
import { assertTechnicianSession } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export interface AddVacationResult {
  ok: boolean;
  error?: string;
}

export async function addVacationAction(args: {
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<AddVacationResult> {
  const session = await assertTechnicianSession();

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(args.startDate) || !dateRe.test(args.endDate)) {
    return { ok: false, error: '날짜 형식 오류 (YYYY-MM-DD)' };
  }

  const start = new Date(args.startDate);
  const end = new Date(args.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: '잘못된 날짜입니다.' };
  }
  if (start < today) {
    return { ok: false, error: '오늘 이전 날짜는 등록할 수 없어요.' };
  }
  if (end < start) {
    return { ok: false, error: '종료일이 시작일보다 빠를 수 없어요.' };
  }

  const reason = (args.reason ?? '').trim().slice(0, 50);

  const client = await getServerClient();
  const { error } = await client.from('technician_vacations').insert({
    technician_id: session.technicianId,
    start_date: args.startDate,
    end_date: args.endDate,
    reason: reason || null,
  });

  if (error) {
    console.error('[addVacationAction] insert failed:', error);
    return { ok: false, error: '휴가 등록에 실패했어요. 본사에 문의해 주세요.' };
  }

  revalidatePath('/availability');
  revalidatePath('/calendar');
  return { ok: true };
}
