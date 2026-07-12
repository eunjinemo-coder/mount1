import 'server-only';

/**
 * installation 엔티티 어댑터 — 시공건(installation_jobs) ↔ 시트 매핑필드.
 *
 * 동기화 대상 = installation_jobs(은진님 본사 시공건 · 시트 A~M 1:1 · 0025). 이 어댑터가
 * installation_jobs 를 MappedRow 로 읽고, 시트발 변경을 반영한다. 순수 엔진(@mount/lib/sheets)은
 * 이 계약(EntityAdapter)만 안다. 매핑 순수 로직은 mapping.ts(테스트 대상)로 분리.
 *
 * ── 쓰기 범위 ────────────────────────────────────────────────────────────────
 *   시트→앱 반영은 매핑 13필드(A~M) 전부 양방향. status 는 시트에 없으므로(앱 내부 상태)
 *   동기화 대상이 아니다 — 시트 어느 편집도 status 를 건드리지 않는다.
 *
 * ── 시트→앱 CREATE (은진님 1차 워크플로) ──────────────────────────────────────
 *   과거 orders 어댑터는 신규 시트행을 거부했다(고객 PII 암호화 프로비저닝 필요).
 *   installation_jobs 는 평문 전용 테이블이라 그 병목이 없다 → 신규 시트행(기존 sheet_row_map
 *   없음)을 새 installation_jobs 로 생성한다. 은진님은 시트에 먼저 시공건을 적는다.
 *   가드: 최소요건(시공일자 또는 성함)이 있을 때만 생성(mapping.hasMinimalForCreate). 없으면
 *   applied=false(reason=create_requires_minimal_fields) → 웹훅이 ⚠ 표기(비파괴).
 *
 * ── archive ─────────────────────────────────────────────────────────────────
 *   시트 행 삭제 → 비파괴 보관은 sheet_row_map.archived_at 마킹(inbound store)으로 기록.
 *   installation_jobs 행은 건드리지 않는다(하드삭제/상태오염 금지 — §2.4 금지선).
 */
import type { EntityAdapter, EntityRecord } from '@mount/lib/sheets';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildInstallationWrite,
  hasMinimalForCreate,
  toFields,
  type InstallationJobRow,
} from './mapping';

const SELECT_COLUMNS =
  'id, scheduled_install_date, received_date, move_date, visit_time, technician_name, ' +
  'customer_phone, customer_phone2, address, address_detail, customer_name, install_type, ' +
  'install_content, special_notes, updated_at';

export function createInstallationAdapter(client: SupabaseClient): EntityAdapter {
  // 연산마다 새 빌더(installation_jobs). generated types 미포함(0025 push 대기) → 국소 캐스팅.
  const table = (): AnyBuilder =>
    (client as unknown as { from: (t: string) => AnyBuilder }).from('installation_jobs');

  return {
    entity: 'installation',

    async read(entityId: string): Promise<EntityRecord | null> {
      const { data, error } = await table().select(SELECT_COLUMNS).eq('id', entityId).maybeSingle();
      if (error || !data) return null;
      const row = data as unknown as InstallationJobRow;
      return { fields: toFields(row), updatedAt: row.updated_at };
    },

    async applyInbound({ entityId, fields }) {
      const write = buildInstallationWrite(fields);

      // ── 신규 시트행 → installation_jobs 생성 ──
      if (!entityId) {
        if (!hasMinimalForCreate(fields)) {
          return { applied: false, entityId: null, reason: 'create_requires_minimal_fields' };
        }
        const { data, error } = await table().insert(write).select('id');
        if (error) return { applied: false, entityId: null, reason: error.message };
        const created = Array.isArray(data) ? (data[0] as { id?: string } | undefined) : null;
        if (!created?.id) return { applied: false, entityId: null, reason: 'create_failed' };
        return { applied: true, entityId: created.id };
      }

      // ── 기존 행 갱신 ──
      if (Object.keys(write).length === 0) {
        return { applied: true, entityId }; // 반영할 매핑 필드 없음
      }
      // 영향행수 확인 — 존재하지 않는 행을 조용히 ok 처리하지 않는다.
      const { data, error } = await table().update(write).eq('id', entityId).select('id');
      if (error) return { applied: false, entityId, reason: error.message };
      if (!Array.isArray(data) || data.length === 0) {
        return { applied: false, entityId, reason: 'entity_not_found' };
      }
      return { applied: true, entityId };
    },

    async archive(_entityId: string): Promise<void> {
      // 비파괴 보관은 sheet_row_map.archived_at 로 기록(inbound store). installation_jobs 는 건드리지 않음.
    },
  };
}

/** supabase 쿼리 빌더 최소 계약(installation_jobs 는 generated types 미포함 — 0025 push 대기). */
interface AnyBuilder
  extends PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> {
  select: (columns: string) => AnyBuilder;
  eq: (column: string, value: string) => AnyBuilder;
  insert: (values: Record<string, unknown>) => AnyBuilder;
  update: (values: Record<string, unknown>) => AnyBuilder;
  maybeSingle: () => PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
}
