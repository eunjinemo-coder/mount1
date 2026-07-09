import 'server-only';

/**
 * 시트 동기화 DI 조립 (service_role 크론/웹훅용). 실 supabase/googleapis 를 순수 엔진에 주입.
 *
 * · makeOutboxDeps  : outbox 워커(앱→시트) — store + Google Sheets 클라 + 어댑터 팩토리
 * · makeInboundDeps : 웹훅(시트→앱)  — store(방향=sheet_to_app 로깅) + 어댑터
 *
 * 서비스계정 미설정 시 makeOutboxDeps 가 throw(sheets 클라 생성 단계) → route 가 잡아 503.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntityAdapter, InboundDeps, InboundStore, OutboxDeps } from '@mount/lib/sheets';
import { loadGoogleServiceAccount } from './config';
import { createInstallationAdapter } from './entity-adapter';
import { createGoogleSheetsApi } from './sheets-client';
import { createSheetSyncStore, type SheetSyncStore } from './store';

/** entity 문자열 → 어댑터. 현재 installation(orders) 만. */
function adapterFactory(client: SupabaseClient): (entity: string) => EntityAdapter | null {
  const installation = createInstallationAdapter(client);
  return (entity) => (entity === 'installation' ? installation : null);
}

export function makeOutboxDeps(serviceClient: SupabaseClient): OutboxDeps {
  const store = createSheetSyncStore(serviceClient);
  const sheets = createGoogleSheetsApi(loadGoogleServiceAccount());
  return { store, sheets, adapterFor: adapterFactory(serviceClient) };
}

/** 웹훅용 — inbound 는 방향 로깅이 sheet_to_app 이어야 하므로 store.log 를 감싼다. */
export function makeInboundDeps(serviceClient: SupabaseClient, entity = 'installation'): InboundDeps {
  const base: SheetSyncStore = createSheetSyncStore(serviceClient);
  const adapter = createInstallationAdapter(serviceClient);

  const inboundStore: InboundStore = {
    dedupInsert: (linkId, syncRowId, hash) => base.dedupInsert(linkId, syncRowId, hash),
    getRowMapBySyncRow: (linkId, syncRowId) => base.getRowMapBySyncRow(linkId, syncRowId),
    setRowMap: (input) => base.setRowMap(input),
    markArchived: (linkId, syncRowId) => base.markArchived(linkId, syncRowId),
    // 방향을 sheet_to_app 로 기록 (base.log 는 app_to_sheet 고정이라 직접 삽입)
    log: async (entry) => {
      await (serviceClient as unknown as { from: (t: string) => { insert: (v: Record<string, unknown>) => PromiseLike<unknown> } })
        .from('sync_log')
        .insert({
          link_id: entry.linkId,
          direction: 'sheet_to_app',
          entity_id: entry.entityId,
          result: entry.result,
          detail: entry.detail ?? null,
        });
    },
  };

  void entity; // 현재 installation 고정(어댑터 선택 확장 지점)
  return { store: inboundStore, adapter };
}
