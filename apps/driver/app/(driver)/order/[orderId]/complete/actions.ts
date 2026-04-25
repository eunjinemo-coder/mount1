'use server';

import { callRpc, getServerClient } from '@mount/db';

export type CompleteVariant = 'no_drill' | 'drill_converted';
export type ConversionMethod = 'verbal' | 'sms' | 'phone';

export interface CompleteResult {
  ok: boolean;
  error?: string;
  newStatus?: string;
  conversionDiff?: number;
}

interface CompletePayload {
  ok: boolean;
  new_status?: string;
  conversion_diff?: number;
}

export async function completeInstallationAction(args: {
  orderId: string;
  variant: CompleteVariant;
  conversionMethod?: ConversionMethod;
}): Promise<CompleteResult> {
  if (args.variant === 'drill_converted' && !args.conversionMethod) {
    return { ok: false, error: '타공 전환 시 합의 방법을 선택해 주세요 (구두/SMS/전화).' };
  }

  const client = await getServerClient();
  const { data, error } = await callRpc<CompletePayload>(client, 'rpc_technician_complete', {
    p_order_id: args.orderId,
    p_variant: args.variant,
    p_conversion_agreed_method: args.conversionMethod ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('missing_post_photos')) {
      return { ok: false, error: '완료 사진 3장(정면·좌·우)이 부족해요. 사진 메뉴에서 업로드 후 다시 시도해 주세요.' };
    }
    if (msg.includes('conversion_method_required')) {
      return { ok: false, error: '타공 전환 시 합의 방법이 필요합니다.' };
    }
    if (msg.includes('invalid_from_status')) {
      return { ok: false, error: '현재 상태에서는 완료할 수 없어요. 시공 시작 후 진행해 주세요.' };
    }
    if (msg.includes('not_your_order')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    return { ok: false, error: '완료 처리 중 문제가 발생했어요.' };
  }

  return {
    ok: Boolean(data?.ok),
    newStatus: data?.new_status,
    conversionDiff: data?.conversion_diff,
  };
}
