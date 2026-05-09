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
  const widthRaw = formData.get('width');
  const heightRaw = formData.get('height');
  const width = typeof widthRaw === 'string' && widthRaw ? Number(widthRaw) : null;
  const height = typeof heightRaw === 'string' && heightRaw ? Number(heightRaw) : null;

  const takenAtRaw = formData.get('takenAt');
  const takenLatRaw = formData.get('takenLat');
  const takenLngRaw = formData.get('takenLng');
  const takenAt = typeof takenAtRaw === 'string' && takenAtRaw ? takenAtRaw : null;
  const takenLatNum = typeof takenLatRaw === 'string' && takenLatRaw ? Number(takenLatRaw) : null;
  const takenLngNum = typeof takenLngRaw === 'string' && takenLngRaw ? Number(takenLngRaw) : null;
  const takenLat = takenLatNum != null && Number.isFinite(takenLatNum) ? takenLatNum : null;
  const takenLng = takenLngNum != null && Number.isFinite(takenLngNum) ? takenLngNum : null;

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

  // 'extra' 슬롯은 multi-row 통합 업로드용 — path 에 unique suffix.
  // 다른 슬롯(pre_*, post_*) 은 슬롯별 고정 경로(덮어쓰기) — race condition 제거.
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const objectPath =
    slot === 'extra'
      ? `${session.technicianId}/${orderId}/extra_${uniqueSuffix}.${ext}`
      : `${session.technicianId}/${orderId}/${slot}.${ext}`;

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

  // photos 테이블 메타 upsert
  // 'extra' 슬롯은 multi-row 허용 (시공 사진 통합 업로드).
  // 다른 슬롯(pre_*, post_*)은 1개만 허용 — 기존 row 있으면 update.
  if (slot === 'extra') {
    const { error: insertError } = await client.from('photos').insert({
      order_id: orderId,
      technician_id: session.technicianId,
      slot,
      storage_tier: 'hot',
      supabase_path: objectPath,
      mime_type: file.type,
      size_bytes: file.size,
      width: width && width > 0 ? width : null,
      height: height && height > 0 ? height : null,
      taken_at: takenAt,
      taken_lat: takenLat,
      taken_lng: takenLng,
    });
    if (insertError) {
      await client.storage.from(STORAGE_BUCKET).remove([objectPath]);
      return { ok: false, error: '사진 메타 저장에 실패했어요.' };
    }
  } else {
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
          width: width && width > 0 ? width : null,
          height: height && height > 0 ? height : null,
          taken_at: takenAt,
          taken_lat: takenLat,
          taken_lng: takenLng,
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
        width: width && width > 0 ? width : null,
        height: height && height > 0 ? height : null,
        taken_at: takenAt,
        taken_lat: takenLat,
        taken_lng: takenLng,
      });
      if (insertError) {
        await client.storage.from(STORAGE_BUCKET).remove([objectPath]);
        return { ok: false, error: '사진 메타 저장에 실패했어요.' };
      }
    }
  }

  revalidatePath(`/order/${orderId}/photos`);
  return { ok: true };
}

/** photo id 로 삭제 — 'extra' multi-row 통합 업로드 지원. */
export async function deletePhotoByIdAction(photoId: string): Promise<UploadResult> {
  if (!UUID_RE.test(photoId)) {
    return { ok: false, error: '잘못된 사진 ID 입니다.' };
  }

  const session = await getSession();
  if (!session?.technicianId) {
    return { ok: false, error: '인증 정보가 만료되었습니다.' };
  }

  const client = await getServerClient();

  const { data: photo } = await client
    .from('photos')
    .select('id, order_id, supabase_path')
    .eq('id', photoId)
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

  revalidatePath(`/order/${photo.order_id}/photos`);
  return { ok: true };
}

/** Legacy: 슬롯별 단일 사진 삭제 (pre_*, post_* 등). */
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
