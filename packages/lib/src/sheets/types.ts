/**
 * 구글시트 양방향 동기화 — 순수 도메인 타입 (DI 계약).
 *
 * 이 모듈의 로직(hash/column-map/conflict/signature/outbox/inbound)은 DB·구글API 를
 * 인터페이스로 주입받아 순수하게 동작한다 → mock 으로 정합/멱등/충돌/금지선을 단위검증.
 * 실 어댑터(supabase/googleapis)는 apps/admin/lib/sheets 가 조립한다.
 */

/** 시트 행 = 앱 필드명 → 문자열 값 (시트 셀은 모두 문자열). 해시/전송의 정본 표현. */
export type MappedRow = Readonly<Record<string, string>>;

/** 시트 열문자(A/B/…) → 앱 필드명 매핑. sheet_links.column_map. */
export type ColumnMap = Readonly<Record<string, string>>;

/** 동기화 대상 엔티티의 현재 스냅샷 (앱 어댑터가 orders 로부터 구성). */
export interface EntityRecord {
  /** 매핑 대상 필드의 현재 값(문자열 정규화). */
  readonly fields: MappedRow;
  /** 앱 측 최종수정시각(ISO). LWW 비교 기준. null=미상. */
  readonly updatedAt: string | null;
}

/** 시트 연결 정의 (sheet_links 투영). */
export interface SheetLink {
  readonly id: string;
  readonly spreadsheetId: string;
  readonly sheetName: string;
  readonly entity: string;
  readonly columnMap: ColumnMap;
  readonly syncIdColumn: string;
  readonly headerRow: number;
  readonly active: boolean;
}

/** 행 식별 매핑 (sheet_row_map 투영). */
export interface RowMap {
  readonly entityId: string;
  readonly syncRowId: string;
  readonly lastSyncedHash: string | null;
  readonly archivedAt: string | null;
}

/** outbox 한 건 (sync_outbox 투영). */
export interface OutboxRow {
  readonly id: number;
  readonly linkId: string;
  readonly entityId: string;
  readonly contentHash: string;
  readonly attempts: number;
}

export type SyncDirection = 'app_to_sheet' | 'sheet_to_app';
export type SyncResult =
  | 'ok'
  | 'skipped_noop'
  | 'conflict_sheet_won'
  | 'conflict_app_won'
  | 'error';

export interface SyncLogEntry {
  readonly linkId: string;
  readonly direction: SyncDirection;
  readonly entityId: string | null;
  readonly result: SyncResult;
  readonly detail?: Record<string, unknown>;
}

/**
 * 엔티티 어댑터 — 도메인 엔티티(orders)의 읽기/적용/보관을 추상화.
 * 순수 엔진은 이 인터페이스만 알며, 실 구현이 orders 를 다룬다(테스트는 mock).
 */
export interface EntityAdapter {
  readonly entity: string;
  /** entity_id 로 현재 스냅샷 조회. 없으면 null. */
  read(entityId: string): Promise<EntityRecord | null>;
  /**
   * 시트발 매핑필드를 앱에 반영(upsert). 신규행이면 생성 시도.
   * @returns applied=true 면 반영, entityId=반영된 앱 엔티티 id. 생성 미지원 시 applied=false.
   */
  applyInbound(
    input: ApplyInboundInput,
  ): Promise<{ applied: boolean; entityId: string | null; reason?: string }>;
  /** 비파괴 보관(§2.4 금지선). 하드삭제 금지. */
  archive(entityId: string): Promise<void>;
}

export interface ApplyInboundInput {
  /** 기존 매핑이 있으면 entityId, 없으면 null(신규행). */
  readonly entityId: string | null;
  readonly fields: MappedRow;
}
