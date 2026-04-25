'use server';

import { getServerClient } from '@mount/db';

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
}

export async function submitCancelReportAction(args: {
  orderId: string;
  category: CancelCategory;
  situationNote: string;
  photoIds?: string[];
  signaturePlaceholder?: string;
}): Promise<CancelResult> {
  if (!args.situationNote || args.situationNote.trim().length < 10) {
    return { ok: false, error: '현장 상황을 10자 이상 구체적으로 작성해 주세요.' };
  }

  const client = await getServerClient();

  // technician_id 는 RLS 정책이 auth.technician_id() 로 검증, technician_id 컬럼은 명시 필요.
  // 간소화: insert 시 technician_id = (auth.jwt() ... ) 패턴 RPC 가 더 안전.
  // 현재는 RLS 가 기사 self check 를 막기 때문에 RPC 미구현 상태에서 직접 insert 는 실패할 수 있음.
  // R5 에서 rpc_technician_cancel 추가 예정.
  const placeholderSignature =
    args.signaturePlaceholder ?? 'placeholder://signature-pending-r5';
  const { error: insertError } = await client.from('cancellation_reports').insert({
    order_id: args.orderId,
    technician_id: '00000000-0000-0000-0000-000000000000', // RLS 통과 위해 RPC 필요 — 현재는 stub
    category_primary: args.category,
    sub_reasons: [],
    situation_note: args.situationNote,
    photo_ids: args.photoIds ?? [],
    signature_image_url: placeholderSignature,
    coupang_transfer_status: 'pending',
  });

  if (insertError) {
    if (insertError.message.includes('row-level security')) {
      return {
        ok: false,
        error: '취소 리포트 RLS — RPC `rpc_technician_cancel` 추가 필요 (R5 작업). 현재는 스텁.',
      };
    }
    return { ok: false, error: '취소 리포트 저장에 실패했어요.' };
  }

  // orders 상태 업데이트
  await client
    .from('orders')
    .update({ status: 'cancel_requested' })
    .eq('id', args.orderId);

  return { ok: true };
}
