'use server';

import { getServerClient } from '@mount/db';
import { getSession } from '@mount/lib';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_RE.test(args.orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }

  if (!args.situationNote || args.situationNote.trim().length < 10) {
    return { ok: false, error: '현장 상황을 10자 이상 구체적으로 작성해 주세요.' };
  }

  const session = await getSession();
  if (!session?.technicianId) {
    return { ok: false, error: '인증 정보가 만료되었습니다. 다시 로그인해 주세요.' };
  }

  const client = await getServerClient();

  // 사진 자동 첨부: caller 가 명시 안 했으면 본 order 의 본인 업로드 사진 모두 자동 link.
  // RLS 가 본인 사진만 select 하도록 보장 — 권한 우회 없음.
  let photoIds = args.photoIds ?? [];
  if (photoIds.length === 0) {
    const { data: photoRows } = await client
      .from('photos')
      .select('id')
      .eq('order_id', args.orderId)
      .eq('technician_id', session.technicianId);
    photoIds = (photoRows ?? []).map((row) => row.id);
  }

  // RLS 정책 cancel_insert_technician: technician_id = public.technician_id() 검증.
  // session.technicianId 는 JWT app_metadata.technician_id 에서 추출된 값으로 일치.
  const placeholderSignature =
    args.signaturePlaceholder ?? 'placeholder://signature-pending-r5';
  const { error: insertError } = await client.from('cancellation_reports').insert({
    order_id: args.orderId,
    technician_id: session.technicianId,
    category_primary: args.category,
    sub_reasons: [],
    situation_note: args.situationNote,
    photo_ids: photoIds,
    signature_image_url: placeholderSignature,
    coupang_transfer_status: 'pending',
  });

  if (insertError) {
    // 내부 아키텍처 정보(RLS·RPC·R5 등) 사용자 노출 금지.
    return {
      ok: false,
      error: '취소 리포트 저장에 실패했어요. 본사 카카오톡 채널로 즉시 보고해 주세요.',
    };
  }

  // orders 상태 업데이트 (RLS 가 자기 배차건만 허용)
  const { error: statusError } = await client
    .from('orders')
    .update({ status: 'cancel_requested' })
    .eq('id', args.orderId);

  if (statusError) {
    return { ok: false, error: '주문 상태 업데이트에 실패했어요. 본사에 보고해 주세요.' };
  }

  return { ok: true };
}
