'use server';

import { callRpc, getServerClient } from '@mount/db';

export interface StartResult {
  ok: boolean;
  error?: string;
  newStatus?: string;
}

interface StartPayload {
  ok: boolean;
  new_status?: string;
}

export async function startInstallationAction(orderId: string): Promise<StartResult> {
  const client = await getServerClient();
  const { data, error } = await callRpc<StartPayload>(
    client,
    'rpc_technician_start_installation',
    { p_order_id: orderId },
  );

  if (error) {
    const msg = error.message || '';
    if (msg.includes('missing_pre_photos')) {
      return { ok: false, error: '시공 전 사진 2장(TV 화면, 벽)이 부족해요. 사진 메뉴에서 업로드 후 다시 시도해 주세요.' };
    }
    if (msg.includes('invalid_from_status')) {
      return { ok: false, error: '현재 상태에서는 시공을 시작할 수 없어요. 현장 도착 처리부터 해주세요.' };
    }
    if (msg.includes('not_your_order')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    return { ok: false, error: '시작 처리 중 문제가 발생했어요.' };
  }

  return {
    ok: Boolean(data?.ok),
    newStatus: data?.new_status,
  };
}
