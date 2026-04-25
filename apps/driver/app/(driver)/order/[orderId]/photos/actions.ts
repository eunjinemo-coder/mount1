'use server';

import { getServerClient } from '@mount/db';
import { getSession } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SLOTS = [
  'pre_tv_screen',
  'pre_wall',
  'in_progress',
  'post_front',
  'post_left',
  'post_right',
  'extra',
  'issue_evidence',
] as const;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const STORAGE_BUCKET = 'photos-hot';

export interface UploadResult {
  ok: boolean;
  error?: string;
}

export async function uploadPhotoAction(formData: FormData): Promise<UploadResult> {
  const orderId = String(formData.get('orderId') ?? '');
  const slot = String(formData.get('slot') ?? '');
  const file = formData.get('file');

  if (!UUID_RE.test(orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }
  if (!(ALLOWED_SLOTS as readonly string[]).includes(slot)) {
    return { ok: false, error: '잘못된 사진 슬롯입니다.' };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: '파일을 선택해 주세요.' };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'JPG · PNG · WebP 만 업로드 가능합니다.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: '파일 크기는 10MB 이하만 가능합니다.' };
  }

  const session = await getSession();
  if (!session?.technicianId) {
    return { ok: false, error: '인증 정보가 만료되었습니다. 다시 로그인해 주세요.' };
  }

  const client = await getServerClient();

  // P1-R5-2 fix: 슬롯별 고정 경로 → 동시 업로드 race condition 제거.
  // Storage 가 자체적으로 덮어쓰기 처리 (upsert: true).
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const objectPath = `${session.technicianId}/${orderId}/${slot}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, {
      cacheControl: '60', // 짧은 캐시 (재촬영 즉시 반영)
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return {
      ok: false,
      error: '사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.',
    };
  }

  // photos 테이블 메타 upsert (slot 별 unique 제약 없으므로 기존 row 조회 후 분기)
  const { data: existing } = await client
    .from('photos')
    .select('id')
    .eq('order_id', orderId)
    .eq('slot', slot)
    .eq('technician_id', session.technicianId)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await client
      .from('photos')
      .update({
        supabase_path: objectPath,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updateError) {
      return { ok: false, error: '사진 메타 업데이트에 실패했어요.' };
    }
  } else {
    const { error: insertError } = await client.from('photos').insert({
      order_id: orderId,
      technician_id: session.technicianId,
      slot,
      storage_tier: 'hot',
      supabase_path: objectPath,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (insertError) {
      // 업로드된 파일 cleanup
      await client.storage.from(STORAGE_BUCKET).remove([objectPath]);
      return { ok: false, error: '사진 메타 저장에 실패했어요.' };
    }
  }

  revalidatePath(`/order/${orderId}/photos`);
  return { ok: true };
}

export async function deletePhotoAction(orderId: string, slot: string): Promise<UploadResult> {
  if (!UUID_RE.test(orderId)) {
    return { ok: false, error: '잘못된 주문 ID입니다.' };
  }
  if (!(ALLOWED_SLOTS as readonly string[]).includes(slot)) {
    return { ok: false, error: '잘못된 사진 슬롯입니다.' };
  }

  const session = await getSession();
  if (!session?.technicianId) {
    return { ok: false, error: '인증 정보가 만료되었습니다.' };
  }

  const client = await getServerClient();

  const { data: photo } = await client
    .from('photos')
    .select('id, supabase_path')
    .eq('order_id', orderId)
    .eq('slot', slot)
    .eq('technician_id', session.technicianId)
    .maybeSingle();

  if (!photo) {
    return { ok: false, error: '삭제할 사진이 없습니다.' };
  }

  if (photo.supabase_path) {
    await client.storage.from(STORAGE_BUCKET).remove([photo.supabase_path]);
  }

  const { error: deleteError } = await client.from('photos').delete().eq('id', photo.id);
  if (deleteError) {
    return { ok: false, error: '사진 삭제에 실패했어요.' };
  }

  revalidatePath(`/order/${orderId}/photos`);
  return { ok: true };
}
