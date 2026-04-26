'use server';

import { callRpc, getServerClient } from '@mount/db';

export interface AssignResult {
  ok: boolean;
  error?: string;
}

export interface RecommendedTechnician {
  technician_id: string;
  display_name: string;
  grade: string;
  score: number;
  distance_km: number | null;
  today_load: number;
  weekly_load: number;
  preferred_match: boolean;
  score_breakdown: {
    distance: number;
    grade: number;
    load: number;
    preferred_region: number;
    fairness: number;
  };
}

export interface RecommendResult {
  ok: boolean;
  recommendations?: RecommendedTechnician[];
  error?: string;
}

export async function recommendTechniciansAction(orderId: string): Promise<RecommendResult> {
  if (!orderId) {
    return { ok: false, error: '주문을 먼저 선택해 주세요.' };
  }

  const client = await getServerClient();
  const { data, error } = await callRpc<RecommendedTechnician[]>(
    client,
    'rpc_admin_recommend_technicians',
    { p_order_id: orderId, p_limit: 5 },
  );

  if (error) {
    const msg = error.message || '';
    if (msg.includes('order_not_found')) {
      return { ok: false, error: '주문을 찾을 수 없습니다.' };
    }
    if (msg.includes('unauthorized')) {
      return { ok: false, error: '추천 조회 권한이 없습니다.' };
    }
    return { ok: false, error: '추천 조회에 실패했어요.' };
  }

  return { ok: true, recommendations: data ?? [] };
}

export async function assignOrderAction(
  orderId: string,
  technicianId: string,
  overrideReason?: string,
): Promise<AssignResult> {
  if (!orderId || !technicianId) {
    return { ok: false, error: '주문과 기사를 모두 선택해 주세요.' };
  }

  const client = await getServerClient();
  const { error } = await callRpc<{ ok: boolean }>(client, 'rpc_admin_dispatch', {
    p_order_id: orderId,
    p_technician_id: technicianId,
    p_override_reason: overrideReason ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('technician_inactive')) {
      return { ok: false, error: '선택한 기사가 비활성 상태입니다.' };
    }
    if (msg.includes('invalid_from_status')) {
      return { ok: false, error: '현재 주문 상태에서는 배차할 수 없어요.' };
    }
    if (msg.includes('unauthorized')) {
      return { ok: false, error: '배차 권한이 없습니다.' };
    }
    return { ok: false, error: '배차에 실패했어요. 다시 시도해 주세요.' };
  }

  return { ok: true };
}
