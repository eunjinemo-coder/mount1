import 'server-only';

/**
 * sheet_* 테이블 기반 저장소 — @mount/lib/sheets 의 OutboxStore·InboundStore 구현 + enqueue.
 *
 * sheet_ 테이블은 dev DB 미push(0024 대기)라 generated types 에 없음 → message-store.ts 와
 * 동일 철학으로 untyped 쿼리 빌더를 국소 캐스팅(사용 메서드만 좁게 선언 · push 후 걷어냄).
 *
 * 멱등:
 *   · dedupInsert: sheet_inbox_dedup unique(link,sync_row,hash) 충돌 → inserted=false
 *   · upsertRowMap: sheet_row_map unique(link,entity) onConflict merge
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { callRpc } from '@mount/db';
import type { OutboxRow, SheetLink } from '@mount/lib/sheets';
import { DEFAULT_INSTALLATION_SYNC_ID_COLUMN } from './mapping';

interface PgError {
  message: string;
  code?: string;
}
type Res<T> = PromiseLike<{ data: T; error: PgError | null }>;

interface Builder extends Res<Record<string, unknown>[] | null> {
  select: (columns?: string) => Builder;
  eq: (column: string, value: string | number | boolean) => Builder;
  in: (column: string, values: readonly (string | number)[]) => Builder;
  lt: (column: string, value: number) => Builder;
  is: (column: string, value: null) => Builder;
  order: (column: string, options: { ascending: boolean }) => Builder;
  limit: (n: number) => Builder;
  maybeSingle: () => Res<Record<string, unknown> | null>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => Res<null>;
  update: (values: Record<string, unknown>) => Builder;
  upsert: (values: Record<string, unknown>, options?: { onConflict: string }) => Res<null>;
}

function tbl(client: SupabaseClient, name: string): Builder {
  return (client as unknown as { from: (t: string) => Builder }).from(name);
}

function toLink(r: Record<string, unknown>): SheetLink {
  return {
    id: String(r.id),
    spreadsheetId: String(r.spreadsheet_id),
    sheetName: String(r.sheet_name),
    entity: String(r.entity),
    columnMap: (r.column_map ?? {}) as Record<string, string>,
    syncIdColumn: String(r.sync_id_column ?? DEFAULT_INSTALLATION_SYNC_ID_COLUMN),
    headerRow: Number(r.header_row ?? 1),
    active: Boolean(r.active),
  };
}

export interface SheetSyncStore {
  // ── OutboxStore ──
  listPending(limit: number): Promise<OutboxRow[]>;
  getLink(linkId: string): Promise<SheetLink | null>;
  ensureRowMap(linkId: string, entityId: string): Promise<{ syncRowId: string }>;
  upsertRowMap(input: { linkId: string; entityId: string; syncRowId: string; lastSyncedHash: string }): Promise<void>;
  markDone(outboxId: number): Promise<void>;
  markFailed(outboxId: number, error: string): Promise<void>;
  log(entry: { linkId: string; entityId: string | null; result: string; detail?: Record<string, unknown> }): Promise<void>;
  /** GC: 오래된 dedup/로그/done outbox 정리(크론 1스텝). */
  gcOldRows(days: number): Promise<void>;
  // ── InboundStore ──
  dedupInsert(linkId: string, syncRowId: string, contentHash: string): Promise<{ inserted: boolean }>;
  getRowMapBySyncRow(
    linkId: string,
    syncRowId: string,
  ): Promise<{ entityId: string; lastSyncedHash: string | null; archivedAt: string | null } | null>;
  setRowMap(input: { linkId: string; entityId: string; syncRowId: string; lastSyncedHash: string }): Promise<void>;
  markArchived(linkId: string, syncRowId: string): Promise<void>;
  // ── enqueue / lookup ──
  activeLinksForEntity(entity: string): Promise<SheetLink[]>;
  enqueueOutbox(linkId: string, entityId: string, contentHash: string): Promise<void>;
  linkBySyncRow(linkId: string): Promise<SheetLink | null>;
  findLinkBySheet(spreadsheetId: string, sheetName: string): Promise<SheetLink | null>;
}

export function createSheetSyncStore(client: SupabaseClient): SheetSyncStore {
  async function insertLog(entry: {
    linkId: string;
    direction: 'app_to_sheet' | 'sheet_to_app';
    entityId: string | null;
    result: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await tbl(client, 'sync_log').insert({
      link_id: entry.linkId,
      direction: entry.direction,
      entity_id: entry.entityId,
      result: entry.result,
      detail: entry.detail ?? null,
    });
  }

  async function upsertRowMapInternal(input: {
    linkId: string;
    entityId: string;
    syncRowId: string;
    lastSyncedHash: string;
  }): Promise<void> {
    const { error } = await tbl(client, 'sheet_row_map').upsert(
      {
        link_id: input.linkId,
        entity_id: input.entityId,
        sync_row_id: input.syncRowId,
        last_synced_hash: input.lastSyncedHash,
      },
      { onConflict: 'link_id,entity_id' },
    );
    if (error) throw new Error(error.message);
  }

  return {
    // OutboxStore.log 는 app_to_sheet 방향
    async log(entry) {
      await insertLog({ ...entry, direction: 'app_to_sheet' });
    },

    async listPending(limit) {
      // C2: 원자적 claim(processing 선점, SKIP LOCKED) — 크론 중첩 시 이중처리 차단.
      const { data, error } = await callRpc<Record<string, unknown>[]>(
        client,
        'rpc_claim_sheet_outbox',
        { p_limit: limit },
      );
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: Number(r.id),
        linkId: String(r.link_id),
        entityId: String(r.entity_id),
        contentHash: String(r.content_hash),
        attempts: Number(r.attempts),
      }));
    },

    async getLink(linkId) {
      const { data } = await tbl(client, 'sheet_links')
        .select('id, spreadsheet_id, sheet_name, entity, column_map, sync_id_column, header_row, active')
        .eq('id', linkId)
        .maybeSingle();
      return data ? toLink(data) : null;
    },

    linkBySyncRow(linkId) {
      return this.getLink(linkId);
    },

    async ensureRowMap(linkId, entityId) {
      // C2: (link,entity) 행매핑 get-or-create → 안정적 sync_row_id(중복 append 차단).
      const { data, error } = await callRpc<string>(client, 'rpc_ensure_sheet_row_map', {
        p_link_id: linkId,
        p_entity_id: entityId,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('ensure_row_map_returned_null');
      return { syncRowId: String(data) };
    },

    upsertRowMap: upsertRowMapInternal,
    setRowMap: upsertRowMapInternal,

    async markDone(outboxId) {
      const { error } = await tbl(client, 'sync_outbox')
        .update({ status: 'done' })
        .eq('id', outboxId);
      if (error) throw new Error(error.message);
    },

    async markFailed(outboxId, errorText) {
      // 원자적 attempts 증가(read→write 경합 제거).
      const { error } = await callRpc(client, 'rpc_fail_sheet_outbox', {
        p_id: outboxId,
        p_error: errorText.slice(0, 500),
      });
      if (error) throw new Error(error.message);
    },

    async gcOldRows(days) {
      const { error } = await callRpc(client, 'rpc_gc_sheets_sync', { p_days: days });
      if (error) throw new Error(error.message);
    },

    async dedupInsert(linkId, syncRowId, contentHash) {
      const { error } = await tbl(client, 'sheet_inbox_dedup').insert({
        link_id: linkId,
        sync_row_id: syncRowId,
        content_hash: contentHash,
      });
      // unique 위반(23505) → 이미 처리된 변경(멱등)
      if (error) {
        if (error.code === '23505') return { inserted: false };
        throw new Error(error.message);
      }
      return { inserted: true };
    },

    async getRowMapBySyncRow(linkId, syncRowId) {
      const { data } = await tbl(client, 'sheet_row_map')
        .select('entity_id, last_synced_hash, archived_at')
        .eq('link_id', linkId)
        .eq('sync_row_id', syncRowId)
        .maybeSingle();
      if (!data) return null;
      return {
        entityId: String(data.entity_id),
        lastSyncedHash: data.last_synced_hash === null ? null : String(data.last_synced_hash),
        archivedAt: data.archived_at === null ? null : String(data.archived_at),
      };
    },

    async markArchived(linkId, syncRowId) {
      const { error } = await tbl(client, 'sheet_row_map')
        .update({ archived_at: new Date().toISOString() })
        .eq('link_id', linkId)
        .eq('sync_row_id', syncRowId);
      if (error) throw new Error(error.message);
    },

    async activeLinksForEntity(entity) {
      const { data, error } = await tbl(client, 'sheet_links')
        .select('id, spreadsheet_id, sheet_name, entity, column_map, sync_id_column, header_row, active')
        .eq('entity', entity)
        .eq('active', true);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toLink);
    },

    async enqueueOutbox(linkId, entityId, contentHash) {
      const { error } = await tbl(client, 'sync_outbox').insert({
        link_id: linkId,
        entity_id: entityId,
        content_hash: contentHash,
      });
      if (error) throw new Error(error.message);
    },

    async findLinkBySheet(spreadsheetId, sheetName) {
      const { data } = await tbl(client, 'sheet_links')
        .select('id, spreadsheet_id, sheet_name, entity, column_map, sync_id_column, header_row, active')
        .eq('spreadsheet_id', spreadsheetId)
        .eq('sheet_name', sheetName)
        .maybeSingle();
      return data ? toLink(data) : null;
    },
  };
}
