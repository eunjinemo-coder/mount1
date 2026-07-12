'use server';

/**
 * 시공(installation_jobs) 서버 액션 — 은진님 본사 시공건 생성/수정 + 앱→시트 동기화 큐잉.
 *
 * 쓰기 권한: super_admin / ops_admin (0025 RLS 와 일치). auditor 는 읽기만.
 * installation_jobs 는 generated types 미포함(0025 push 대기) → 국소 untyped 캐스팅.
 * 저장 성공 후 enqueueSheetSync(id) → 활성 시트 링크로 앱→시트 반영(best-effort).
 */
import { getServerClient } from '@mount/db';
import { assertAdminRole, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';
import { enqueueSheetSync } from '@/lib/sheets/enqueue';
import { isValidIsoDate } from '@/lib/sheets/mapping';

const WRITE_ROLES = ['super_admin', 'ops_admin'] as const;
export const INSTALLATION_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const;

const DATE_FIELDS = ['scheduled_install_date', 'received_date', 'move_date'] as const;
const TEXT_FIELDS = [
  'visit_time',
  'technician_name',
  'customer_phone',
  'customer_phone2',
  'address',
  'address_detail',
  'customer_name',
  'install_type',
  'install_content',
  'special_notes',
] as const;

export interface InstallationFormInput {
  scheduled_install_date: string;
  received_date: string;
  move_date: string;
  visit_time: string;
  technician_name: string;
  customer_phone: string;
  customer_phone2: string;
  address: string;
  address_detail: string;
  customer_name: string;
  install_type: string;
  install_content: string;
  special_notes: string;
  status: string;
}

export interface InstallationActionResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const DATE_LABEL: Record<string, string> = {
  scheduled_install_date: '시공일자',
  received_date: '접수일자',
  move_date: '이사일자',
};

/** 폼 입력 → installation_jobs 쓰기행. 날짜 형식·상태·최소요건 검증. */
function buildRow(input: InstallationFormInput): { row?: Record<string, unknown>; error?: string } {
  const row: Record<string, unknown> = {};

  for (const key of DATE_FIELDS) {
    const v = (input[key] ?? '').trim();
    if (v.length === 0) {
      row[key] = null;
      continue;
    }
    if (!isValidIsoDate(v)) return { error: `${DATE_LABEL[key]} 형식 오류 (YYYY-MM-DD)` };
    row[key] = v;
  }

  for (const key of TEXT_FIELDS) {
    const v = (input[key] ?? '').trim();
    row[key] = v.length === 0 ? null : v;
  }

  const status = (input.status ?? '').trim() || 'scheduled';
  if (!INSTALLATION_STATUSES.includes(status as (typeof INSTALLATION_STATUSES)[number])) {
    return { error: '상태 값 오류' };
  }
  row.status = status;

  if (!row.scheduled_install_date && !row.customer_name) {
    return { error: '시공일자 또는 성함 중 하나는 반드시 입력하세요.' };
  }
  return { row };
}

interface InsertBuilder {
  insert: (v: Record<string, unknown>) => {
    select: (c: string) => {
      maybeSingle: () => PromiseLike<{ data: { id?: string } | null; error: { message: string } | null }>;
    };
  };
  update: (v: Record<string, unknown>) => {
    eq: (c: string, val: string) => {
      select: (c: string) => PromiseLike<{ data: { id?: string }[] | null; error: { message: string } | null }>;
    };
  };
}

export async function createInstallationJobAction(
  input: InstallationFormInput,
): Promise<InstallationActionResult> {
  await assertAdminRole(WRITE_ROLES);
  const { row, error } = buildRow(input);
  if (error || !row) return { ok: false, error };

  const client = await getServerClient();
  const table = (client as unknown as { from: (t: string) => InsertBuilder }).from('installation_jobs');
  const { data, error: dbError } = await table.insert(row).select('id').maybeSingle();
  if (dbError || !data?.id) return { ok: false, error: '시공 저장 실패(권한/DB 확인)' };

  await enqueueSheetSync(data.id);
  revalidatePath('/installations');
  return { ok: true, id: data.id };
}

export async function updateInstallationJobAction(
  id: string,
  input: InstallationFormInput,
): Promise<InstallationActionResult> {
  await assertAdminRole(WRITE_ROLES);
  if (!isValidUuid(id)) return { ok: false, error: '잘못된 시공 ID' };
  const { row, error } = buildRow(input);
  if (error || !row) return { ok: false, error };

  const client = await getServerClient();
  const table = (client as unknown as { from: (t: string) => InsertBuilder }).from('installation_jobs');
  const { data, error: dbError } = await table.update(row).eq('id', id).select('id');
  if (dbError) return { ok: false, error: '시공 수정 실패(권한/DB 확인)' };
  if (!data || data.length === 0) return { ok: false, error: '시공건을 찾을 수 없습니다.' };

  await enqueueSheetSync(id);
  revalidatePath('/installations');
  revalidatePath(`/installations/${id}`);
  return { ok: true, id };
}
