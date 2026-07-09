import 'server-only';

/**
 * installation 엔티티 어댑터 — 시공건(orders) ↔ 시트 매핑필드.
 *
 * 동기화 대상은 orders(일정면 · 0024 헤더 참조). 이 어댑터가 orders 를 MappedRow 로
 * 읽고, 시트발 변경을 orders 에 반영한다. 순수 엔진(@mount/lib/sheets)은 이 계약만 안다.
 * 매핑 순수 로직은 mapping.ts(테스트 대상)로 분리.
 *
 * ── 쓰기 범위(안전) ─────────────────────────────────────────────────────────
 *   시트→앱 반영은 status(enum 검증) · scheduled_installation_at · special_notes 만.
 *   읽기전용 투영(region / phone_tail4 / technician_name / tv 필드)은 시트에서 되돌려 써도
 *   orders 를 덮지 않는다(오염·PII 훼손 방지).
 *
 * ── 부분구현(TODO) ──────────────────────────────────────────────────────────
 *   · 신규 시트행 → 신규 orders 생성: customer PII(암호화) 프로비저닝 필요 → 이번 패스
 *     applied=false(reason=create_requires_provisioning)(비파괴). 웹훅이 ⚠ 표기.
 *   · archive: 비파괴 보관은 sheet_row_map.archived_at 로 기록(inbound store). orders 행은
 *     의도적으로 건드리지 않는다(하드삭제/상태오염 금지 — 0024 §금지선).
 */
import type { EntityAdapter, EntityRecord } from '@mount/lib/sheets';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrderPatch, toFields, type OrderJoinRow } from './mapping';

export function createInstallationAdapter(client: SupabaseClient): EntityAdapter {
  return {
    entity: 'installation',

    async read(entityId: string): Promise<EntityRecord | null> {
      const { data, error } = await client
        .from('orders')
        .select(
          'id, status, scheduled_installation_at, tv_brand, tv_model, tv_size_inch, special_notes, updated_at, customers(phone_tail4, address_region_sido, address_region_sigungu), technicians:assigned_technician_id(display_name)',
        )
        .eq('id', entityId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as unknown as OrderJoinRow;
      return { fields: toFields(row), updatedAt: row.updated_at };
    },

    async applyInbound({ entityId, fields }) {
      // 신규행 생성은 PII 프로비저닝 필요 → 이번 패스 비지원(비파괴).
      if (!entityId) {
        return { applied: false, entityId: null, reason: 'create_requires_provisioning' };
      }
      const patch = buildOrderPatch(fields);
      if (Object.keys(patch).length === 0) {
        return { applied: true, entityId }; // 반영할 쓰기허용 필드 없음
      }
      // D1: 영향행수 확인 — 존재하지 않는 orders 를 조용히 ok 처리하지 않는다.
      const { data, error } = await client
        .from('orders')
        .update(patch)
        .eq('id', entityId)
        .select('id');
      if (error) return { applied: false, entityId, reason: error.message };
      if (!data || data.length === 0) {
        return { applied: false, entityId, reason: 'entity_not_found' };
      }
      return { applied: true, entityId };
    },

    async archive(_entityId: string): Promise<void> {
      // 비파괴 보관은 sheet_row_map.archived_at 로 기록(inbound store). orders 는 건드리지 않음.
    },
  };
}
