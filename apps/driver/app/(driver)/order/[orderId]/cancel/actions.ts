'use server';

import { callRpc, getServerClient } from '@mount/db';
import { assertTechnicianSession, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export type CancelCategory =
  | 'no_drill_structural'
  | 'conversion_declined'
  | 'customer_absent_3times'
  | 'address_issue'
  | 'tv_model_mismatch'
  | 'etc';

export interface CancelResult {
  ok: boolean;
  error?: string;
  reportId?: string;
  photoCount?: number;
}

/**
 * 취소 보고 제출 — 단일 RPC 으로 atomic 처리 (P0-4 fix).
 * 이전에는 cancellation_reports INSERT + orders UPDATE 가 별개 트랜잭션이라
 * 부분 실패 시 데이터 부정합 발생 가능했음.
 * 0016_rpc_cancel_atomic.sql 의 rpc_technician_request_cancel 가 단일 트랜잭션 보장.
 */
export async function submitCancelReportAction(args: {
  orderId: string;
  category: CancelCategory;
  situationNote: string;
  photoIds?: string[];
  signaturePlaceholder?: string;
}): Promise<CancelResult> {
  // P0 — 세션 가드
  await assertTechnicianSession();

  if (!isValidUuid(args.orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }
  if (
    !['no_drill_structural', 'conversion_declined', 'customer_absent_3times', 'address_issue', 'tv_model_mismatch', 'etc'].includes(
      args.category,
    )
  ) {
    return { ok: false, error: '잘못된 취소 사유 카테고리입니다.' };
  }
  if (!args.situationNote || args.situationNote.trim().length < 10) {
    return { ok: false, error: '현장 상황을 10자 이상 구체적으로 작성해 주세요.' };
  }

  const client = await getServerClient();

  const { data, error } = await callRpc<{
    ok: boolean;
    report_id?: string;
    photo_count?: number;
  }>(client, 'rpc_technician_request_cancel', {
    p_order_id: args.orderId,
    p_category: args.category,
    p_situation_note: args.situationNote,
    p_signature_image_url:
      args.signaturePlaceholder ?? 'placeholder://signature-pending-r5',
    p_photo_ids: args.photoIds ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('unauthorized')) {
      return { ok: false, error: '인증 정보가 만료되었습니다. 다시 로그인해 주세요.' };
    }
    if (msg.includes('not_your_order')) {
      return { ok: false, error: '본인 배차건이 아닙니다.' };
    }
    if (msg.includes('invalid_from_status')) {
      return {
        ok: false,
        error: '현장 도착(또는 시공 중) 상태에서만 취소 보고가 가능해요.',
      };
    }
    if (msg.includes('invalid_category')) {
      return { ok: false, error: '취소 사유 값이 올바르지 않습니다.' };
    }
    if (msg.includes('situation_note_too_short')) {
      return { ok: false, error: '현장 상황을 10자 이상 구체적으로 작성해 주세요.' };
    }
    if (msg.includes('order_not_found')) {
      return { ok: false, error: '주문을 찾을 수 없습니다.' };
    }
    console.error('[submitCancelReportAction] RPC error:', error);
    return {
      ok: false,
      error: '취소 보고 저장에 실패했어요. 본사 카카오톡 채널로 즉시 알려 주세요.',
    };
  }

  revalidatePath(`/order/${args.orderId}`);
  revalidatePath('/today');

  return {
    ok: true,
    reportId: data?.report_id,
    photoCount: data?.photo_count,
  };
}
