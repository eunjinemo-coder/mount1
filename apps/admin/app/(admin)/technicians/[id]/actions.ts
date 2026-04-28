'use server';

import { getServerClient } from '@mount/db';
import { ForbiddenError, getSession } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TechnicianMutationResult {
  ok: boolean;
  error?: string;
}

async function assertSuperAdmin(): Promise<void> {
  const session = await getSession();
  if (!session || session.adminRole !== 'super_admin') {
    throw new ForbiddenError('only_super_admin');
  }
}

function validateId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function unlockTechnicianAction(id: string): Promise<TechnicianMutationResult> {
  await assertSuperAdmin();
  if (!validateId(id)) return { ok: false, error: '잘못된 기사 ID 입니다.' };

  const client = await getServerClient();
  const { error } = await client
    .from('technicians')
    .update({ failed_login_count: 0, locked_until: null })
    .eq('id', id);

  if (error) return { ok: false, error: '잠금 해제 실패' };
  revalidatePath(`/technicians/${id}`);
  revalidatePath('/technicians');
  return { ok: true };
}

export async function updateGradeAction(
  id: string,
  grade: 'bronze' | 'silver' | 'gold',
): Promise<TechnicianMutationResult> {
  await assertSuperAdmin();
  if (!validateId(id)) return { ok: false, error: '잘못된 기사 ID 입니다.' };
  if (!['bronze', 'silver', 'gold'].includes(grade)) {
    return { ok: false, error: '등급 값 오류' };
  }

  const client = await getServerClient();
  const { error } = await client.from('technicians').update({ grade }).eq('id', id);

  if (error) return { ok: false, error: '등급 변경 실패' };
  revalidatePath(`/technicians/${id}`);
  revalidatePath('/technicians');
  return { ok: true };
}

export async function updateStatusAction(
  id: string,
  status: 'active' | 'paused' | 'terminated',
): Promise<TechnicianMutationResult> {
  await assertSuperAdmin();
  if (!validateId(id)) return { ok: false, error: '잘못된 기사 ID 입니다.' };
  if (!['active', 'paused', 'terminated'].includes(status)) {
    return { ok: false, error: '상태 값 오류' };
  }

  const client = await getServerClient();
  const { error } = await client.from('technicians').update({ status }).eq('id', id);

  if (error) return { ok: false, error: '상태 변경 실패' };
  revalidatePath(`/technicians/${id}`);
  revalidatePath('/technicians');
  return { ok: true };
}

export async function updateCapacityAction(
  id: string,
  dailyMaxJobs: number,
  weekendEnabled: boolean,
): Promise<TechnicianMutationResult> {
  await assertSuperAdmin();
  if (!validateId(id)) return { ok: false, error: '잘못된 기사 ID 입니다.' };
  if (!Number.isInteger(dailyMaxJobs) || dailyMaxJobs < 1 || dailyMaxJobs > 20) {
    return { ok: false, error: '일 한도는 1~20' };
  }

  const client = await getServerClient();
  const { error } = await client
    .from('technicians')
    .update({ daily_max_jobs: dailyMaxJobs, weekend_enabled: weekendEnabled })
    .eq('id', id);

  if (error) return { ok: false, error: '한도 변경 실패' };
  revalidatePath(`/technicians/${id}`);
  return { ok: true };
}
