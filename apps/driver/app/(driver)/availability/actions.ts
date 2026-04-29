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

  // 중복 휴가 가드 — 같은 기사의 기존 휴가와 기간이 겹치면 거부.
  // overlap 조건: existing.start_date <= 신규.end AND existing.end_date >= 신규.start
  const { data: overlapping } = await client
    .from('technician_vacations')
    .select('id', { head: false, count: 'exact' })
    .eq('technician_id', session.technicianId)
    .lte('start_date', args.endDate)
    .gte('end_date', args.startDate)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { ok: false, error: '해당 기간에 이미 등록된 휴가가 있어요.' };
  }

  const { error } = await client.from('technician_vacations').insert({
    technician_id: session.technicianId,
    start_date: args.startDate,
    end_date: args.endDate,
    reason: reason || null,
  });

  if (error) {
    // 민감 정보 노출 방지 — code/message 만 로그.
    console.error('[addVacationAction] insert failed', { code: error.code, message: error.message });
    return { ok: false, error: '휴가 등록에 실패했어요. 본사에 문의해 주세요.' };
  }

  revalidatePath('/availability');
  revalidatePath('/calendar');
  return { ok: true };
}
