'use server';

/**
 * 구글시트 연동 설정 server actions (super_admin / dispatch_admin).
 *
 * sheet_ 테이블은 generated types 미포함 → 국소 untyped 캐스팅(push 후 걷어냄).
 * 시트 양식은 바꾸지 않는다 — column_map 이 은진님 열배치를 앱 필드로 옮길 뿐.
 */
import { getServerClient } from '@mount/db';
import { assertAdminRole } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const SHEETS_ROLES = ['super_admin', 'dispatch_admin'] as const;

export interface SheetsActionResult {
  ok: boolean;
  error?: string;
}

/** 구글시트 URL(또는 raw id)에서 spreadsheetId 추출. */
function parseSpreadsheetId(input: string): string | null {
  const t = input.trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(t);
  if (m) return m[1] ?? null;
  // raw id(영숫자/_/-, 20자 이상)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(t)) return t;
  return null;
}

/**
 * 매핑 가능한 앱 필드 화이트리스트 (entity-adapter/mapping.ts 와 일치).
 * 쓰기: status·scheduled_date·special_notes / 읽기전용 투영: 나머지.
 * code#7: 오타·미지원 필드·중복 매핑을 거부해 조용한 미반영/충돌을 방지.
 */
const ALLOWED_SHEET_FIELDS = new Set([
  'status',
  'scheduled_date',
  'special_notes',
  'phone_tail4',
  'region_sido',
  'region_sigungu',
  'tv_brand',
  'tv_model',
  'tv_size',
  'technician_name',
]);

/** column_map JSON 검증 — Record<string,string>(열문자→앱필드). 화이트리스트+중복 거부. */
function parseColumnMap(raw: string): { map?: Record<string, string>; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: '열 매핑 JSON 형식 오류' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: '열 매핑은 {"B":"scheduled_date",...} 형태여야 합니다.' };
  }
  const map: Record<string, string> = {};
  const seenCols = new Set<string>();
  const seenFields = new Set<string>();
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[A-Za-z]{1,3}$/.test(k)) return { error: `열문자 오류: ${k}` };
    if (typeof v !== 'string' || v.trim().length === 0) return { error: `필드명 오류: ${k}` };
    const col = k.toUpperCase();
    const field = v.trim();
    if (!ALLOWED_SHEET_FIELDS.has(field)) {
      return { error: `지원하지 않는 앱 필드: "${field}" (오타 확인)` };
    }
    if (seenCols.has(col)) return { error: `열문자 중복: ${col}` };
    if (seenFields.has(field)) return { error: `필드 중복 매핑: ${field}` };
    seenCols.add(col);
    seenFields.add(field);
    map[col] = field;
  }
  if (Object.keys(map).length === 0) return { error: '열 매핑이 비어 있습니다.' };
  return { map };
}

export interface ConnectSheetInput {
  spreadsheetUrl: string;
  sheetName: string;
  columnMapJson: string;
  syncIdColumn?: string;
  headerRow?: number;
}

export async function connectSheetAction(input: ConnectSheetInput): Promise<SheetsActionResult> {
  await assertAdminRole(SHEETS_ROLES);

  const spreadsheetId = parseSpreadsheetId(input.spreadsheetUrl);
  if (!spreadsheetId) return { ok: false, error: '구글시트 URL 을 인식할 수 없습니다.' };
  const sheetName = input.sheetName.trim();
  if (sheetName.length === 0) return { ok: false, error: '탭 이름을 입력하세요.' };

  const { map, error } = parseColumnMap(input.columnMapJson);
  if (error || !map) return { ok: false, error };

  const syncIdColumn = (input.syncIdColumn?.trim() || 'A').toUpperCase();
  if (!/^[A-Za-z]{1,3}$/.test(syncIdColumn)) return { ok: false, error: '_sync_id 열문자 오류' };
  const headerRow = input.headerRow && input.headerRow >= 1 ? Math.floor(input.headerRow) : 1;

  const client = await getServerClient();
  const { error: dbError } = await (
    client as unknown as { from: (t: string) => { upsert: (v: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: { message: string } | null }> } }
  )
    .from('sheet_links')
    .upsert(
      {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        entity: 'installation',
        column_map: map,
        sync_id_column: syncIdColumn,
        header_row: headerRow,
        active: true,
      },
      { onConflict: 'spreadsheet_id,sheet_name' },
    );

  if (dbError) return { ok: false, error: '연결 저장 실패(권한/DB 확인)' };

  revalidatePath('/settings/sheets');
  return { ok: true };
}

export async function toggleSheetActiveAction(linkId: string, active: boolean): Promise<SheetsActionResult> {
  await assertAdminRole(SHEETS_ROLES);
  const client = await getServerClient();
  const { error } = await (
    client as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, val: string) => PromiseLike<{ error: { message: string } | null }> } } }
  )
    .from('sheet_links')
    .update({ active })
    .eq('id', linkId);
  if (error) return { ok: false, error: '상태 변경 실패' };
  revalidatePath('/settings/sheets');
  return { ok: true };
}

/** 실패한 outbox 를 pending 으로 되돌려 다음 크론에 재시도. */
export async function retryFailedSyncAction(linkId: string): Promise<SheetsActionResult> {
  await assertAdminRole(SHEETS_ROLES);
  const client = await getServerClient();
  const { error } = await (
    client as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, val: string) => { eq: (c: string, val: string) => PromiseLike<{ error: { message: string } | null }> } } } }
  )
    .from('sync_outbox')
    .update({ status: 'pending', attempts: 0, last_error: null })
    .eq('link_id', linkId)
    .eq('status', 'failed');
  if (error) return { ok: false, error: '재시도 큐잉 실패' };
  revalidatePath('/settings/sheets');
  return { ok: true };
}
