/**
 * @mount/lib/sheets — 구글시트 양방향 동기화 순수 엔진.
 * 실 어댑터(supabase/googleapis)는 apps/admin/lib/sheets 가 이 계약으로 조립한다.
 */
export type {
  MappedRow,
  ColumnMap,
  EntityRecord,
  SheetLink,
  RowMap,
  OutboxRow,
  SyncDirection,
  SyncResult,
  SyncLogEntry,
  EntityAdapter,
  ApplyInboundInput,
} from './types';

export { contentHash, canonicalize, normalizeValue, sameContent } from './hash';
export {
  buildSheetRow,
  parseSheetRow,
  mappedFieldsForHash,
  columnLetterToIndex,
} from './column-map';
export type { ParseResult, ParseWarning } from './column-map';
export {
  resolveConflict,
  DEFAULT_CONFLICT_WINDOW_SEC,
} from './conflict';
export type { ConflictWinner, ConflictDecision } from './conflict';
export {
  sheetsSignature,
  verifySheetsSignature,
  SHEETS_SIGNATURE_HEADER,
} from './signature';
export { processOutboxBatch } from './outbox';
export type { SheetsApi, OutboxStore, OutboxDeps, OutboxSummary } from './outbox';
export { processInboundRow } from './inbound';
export type {
  InboundPayload,
  InboundStore,
  InboundDeps,
  InboundOutcome,
} from './inbound';
