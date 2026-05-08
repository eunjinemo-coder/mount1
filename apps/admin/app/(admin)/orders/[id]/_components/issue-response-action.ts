'use server';

import { getServerClient } from '@mount/db';
import { assertAdminRole, isValidUuid } from '@mount/lib';
import { revalidatePath } from 'next/cache';

export interface IssueResponseResult {
  ok: boolean;
  error?: string;
}

const RESPONSE_ROLES = ['super_admin', 'cs_admin', 'ops_admin'] as const;

export async function respondToIssueAction(args: {
  issueId: string;
  orderId: string;
  responseText: string;
}): Promise<IssueResponseResult> {
  const session = await assertAdminRole(RESPONSE_ROLES);

  if (!isValidUuid(args.issueId)) return { ok: false, error: '잘못된 이슈 ID' };
  if (!isValidUuid(args.orderId)) return { ok: false, error: '잘못된 주문 ID' };
  if (!args.responseText.trim()) return { ok: false, error: '응답 내용이 비어 있습니다.' };

  const supabase = await getServerClient();
  const { error } = await supabase
    .from('issues')
    .update({
      admin_response_text: args.responseText.trim(),
      admin_response_at: new Date().toISOString(),
      admin_responder_id: session.adminUserId ?? session.userId,
    } as never)
    .eq('id', args.issueId);

  if (error) return { ok: false, error: '응답 저장 실패: ' + error.message };

  revalidatePath(`/orders/${args.orderId}`);
  return { ok: true };
}
