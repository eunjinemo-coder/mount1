'use server';

/**
 * 시공(installation_jobs) 서버 액션 — 은진님 본사 시공건 생성/수정 + 앱→시트 동기화 큐잉.
 *
 * 쓰기 권한: super_admin / ops_admin (0025 RLS 와 일치). auditor 는 읽기만.
 * installation_jobs 는 generated types 미포함(0025 push 대기) → 국소 untyped 캐스팅.
 * 저장 성공 후 enqueueSheetSync(id) → 활성 시트 링크로 앱→시트 반영(best-effort).
 */
import { getServerClient } from '@mount/db';
import { getAdminClient } from '@mount/db/admin';
import { assertAdminRole, isValidUuid, log } from '@mount/lib';
import { revalidatePath } from 'next/cache';
import { hasGoogleServiceAccount, loadGoogleServiceAccount } from '@/lib/sheets/config';
import { enqueueSheetSync } from '@/lib/sheets/enqueue';
import { isValidIsoDate } from '@/lib/sheets/mapping';
import { deleteSheetRowBySyncId } from '@/lib/sheets/sheets-client';
import { createSheetSyncStore } from '@/lib/sheets/store';

const WRITE_ROLES = ['super_admin', 'ops_admin'] as const;
// 'use server' 파일은 async 함수만 export 가능(Next.js 제약) → 모듈 내부 상수로 유지(비export).
const INSTALLATION_STATUSES = [
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

const DELETE_MAX = 100; // 한 번에 지울 수 있는 최대 건수(실수 방어)
const PHOTO_BUCKET = 'photos-hot';

export interface DeleteJobsResult {
  ok: boolean;
  deleted: number;
  sheetDeleted: number;
  error?: string;
}

/**
 * 시공건 일괄 삭제 — 사람이 명시적으로 수행하는 유일한 하드삭제 경로.
 *
 * 순서(건별): ① 연결 시트의 해당 행 삭제(deleteDimension — 빈 행 안 남음, best-effort)
 *   ② 동기화 side-table(sync_outbox·sheet_row_map) 정리(FK restrict 해제)
 *   ③ 사진 Storage 오브젝트 회수(best-effort) ④ installation_jobs 삭제(사진 메타는 cascade).
 * service_role 사용: side-table 은 워커 전용 RLS 라 admin 세션으론 정리 불가.
 */
export async function deleteInstallationJobsAction(ids: string[]): Promise<DeleteJobsResult> {
  await assertAdminRole(WRITE_ROLES);
  const valid = [...new Set(ids)].filter((id) => isValidUuid(id));
  if (valid.length === 0) return { ok: false, deleted: 0, sheetDeleted: 0, error: '선택된 시공이 없습니다.' };
  if (valid.length > DELETE_MAX) {
    return { ok: false, deleted: 0, sheetDeleted: 0, error: `한 번에 ${DELETE_MAX}건까지만 삭제할 수 있어요.` };
  }

  const admin = getAdminClient();
  const store = createSheetSyncStore(admin);
  const sa = hasGoogleServiceAccount() ? loadGoogleServiceAccount() : null;
  const cast = admin as unknown as {
    from: (t: string) => {
      select: (c: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: Record<string, unknown>[] | null }> };
      delete: () => { in: (c: string, v: string[]) => PromiseLike<{ error: { message: string } | null }> };
    };
  };

  // ① 시트 행 삭제(best-effort) — 링크별 row_map 의 sync_row_id 로 행 식별
  let sheetDeleted = 0;
  const { data: rowMaps } = await cast
    .from('sheet_row_map')
    .select('link_id, entity_id, sync_row_id')
    .in('entity_id', valid);
  if (sa) {
    for (const rm of rowMaps ?? []) {
      try {
        const link = await store.getLink(String(rm.link_id));
        if (!link || !link.active) continue;
        const { deleted } = await deleteSheetRowBySyncId(sa, link, String(rm.sync_row_id));
        if (deleted) sheetDeleted += 1;
      } catch (e) {
        // 시트 삭제 실패해도 앱 삭제는 진행(시트에 잔행 남으면 수동 정리) — 관측만.
        log.warn('시트 행 삭제 실패(앱 삭제는 진행)', {
          entityId: String(rm.entity_id),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // ③ 사진 Storage 회수(best-effort) — 메타행은 ④ cascade 로 정리
  const { data: photos } = await cast
    .from('installation_photos')
    .select('storage_path')
    .in('installation_job_id', valid);
  const paths = (photos ?? []).map((p) => String(p.storage_path)).filter((p) => p.length > 0);
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
    if (rmErr) log.warn('시공사진 Storage 회수 실패(삭제는 진행)', { count: paths.length, error: rmErr.message });
  }

  // ② FK restrict 해제 → ④ 본체 삭제
  const { error: outboxErr } = await cast.from('sync_outbox').delete().in('entity_id', valid);
  if (outboxErr) return { ok: false, deleted: 0, sheetDeleted, error: '동기화 큐 정리 실패' };
  const { error: mapErr } = await cast.from('sheet_row_map').delete().in('entity_id', valid);
  if (mapErr) return { ok: false, deleted: 0, sheetDeleted, error: '행매핑 정리 실패' };
  const { error: jobErr } = await cast.from('installation_jobs').delete().in('id', valid);
  if (jobErr) return { ok: false, deleted: 0, sheetDeleted, error: '시공 삭제 실패' };

  log.info('시공 일괄 삭제', { count: valid.length, sheetDeleted });
  revalidatePath('/installations');
  revalidatePath('/today');
  return { ok: true, deleted: valid.length, sheetDeleted };
}
