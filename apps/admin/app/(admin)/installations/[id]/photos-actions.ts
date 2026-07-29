'use server';

/**
 * 시공(installation_jobs) 사진 서버 액션 — 완료사진 업로드/삭제/캡션수정.
 *
 * 권한: super_admin / ops_admin (installation_jobs·installation_photos RLS 와 일치).
 * 저장소: Storage 'photos-hot' 버킷, 경로 installations/{jobId}/{uuid}.{ext} (0026 정책).
 * 클라이언트: getServerClient(RLS) — 마스터 세션의 JWT 로 Storage/테이블 정책을 통과한다.
 *
 * installation_photos 는 generated types 미포함(0026 push 대기) → 국소 untyped 캐스팅
 * (actions.ts 의 installation_jobs 패턴과 동일).
 */
import { getServerClient } from '@mount/db';
import { assertAdminRole, getSession, isValidUuid, log } from '@mount/lib';
import { revalidatePath } from 'next/cache';

const WRITE_ROLES = ['super_admin', 'ops_admin'] as const;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const STORAGE_BUCKET = 'photos-hot';
const MAX_CAPTION = 500;

export interface PhotoActionResult {
  ok: boolean;
  error?: string;
}

function extFor(mime: string): string {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
}

/** 시공건에 사진 1장 업로드 (여러 번 호출로 여러 장). */
export async function uploadInstallationPhotoAction(formData: FormData): Promise<PhotoActionResult> {
  await assertAdminRole(WRITE_ROLES);

  const jobId = String(formData.get('jobId') ?? '');
  const file = formData.get('file');
  const captionRaw = formData.get('caption');
  const caption =
    typeof captionRaw === 'string' && captionRaw.trim().length > 0
      ? captionRaw.trim().slice(0, MAX_CAPTION)
      : null;

  if (!isValidUuid(jobId)) return { ok: false, error: '잘못된 시공 ID입니다.' };
  if (!(file instanceof File)) return { ok: false, error: '파일을 선택해 주세요.' };
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'JPG · PNG · WebP 만 업로드 가능합니다.' };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: '파일 크기는 10MB 이하만 가능합니다.' };

  const session = await getSession();
  if (!session?.adminUserId) {
    return { ok: false, error: '인증 정보가 만료되었습니다. 다시 로그인해 주세요.' };
  }

  const client = await getServerClient();

  // 업로드 전 시공건 존재 확인 — 없는 jobId 로 고아 오브젝트가 생기지 않게(FK 롤백에만 의존하지 않음).
  const { data: job } = await (
    client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => PromiseLike<{ data: { id: string } | null }>;
          };
        };
      };
    }
  )
    .from('installation_jobs')
    .select('id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: '시공건을 찾을 수 없습니다.' };

  // 슬롯 없음 — 매 업로드마다 고유 경로(덮어쓰기 없이 누적).
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const objectPath = `installations/${jobId}/${uniqueSuffix}.${extFor(file.type)}`;

  const { error: uploadError } = await client.storage.from(STORAGE_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { ok: false, error: '사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.' };
  }

  const table = (
    client as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
      };
    }
  ).from('installation_photos');

  const { error: insertError } = await table.insert({
    installation_job_id: jobId,
    storage_path: objectPath,
    caption,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by_admin_id: session.adminUserId,
  });

  if (insertError) {
    // 메타 저장 실패 → 고아 오브젝트 회수(best-effort). 회수 실패는 관측만(수동 GC 대상).
    const { error: removeError } = await client.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (removeError) {
      log.warn('시공사진 고아 오브젝트 회수 실패', { objectPath, error: removeError.message });
    }
    return { ok: false, error: '사진 메타 저장에 실패했어요.' };
  }

  revalidatePath(`/installations/${jobId}`);
  return { ok: true };
}

/** 사진 id 로 삭제 (Storage 오브젝트 + 메타행). */
export async function deleteInstallationPhotoAction(photoId: string): Promise<PhotoActionResult> {
  await assertAdminRole(WRITE_ROLES);
  if (!isValidUuid(photoId)) return { ok: false, error: '잘못된 사진 ID입니다.' };

  const client = await getServerClient();

  const { data: photo } = await (
    client as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => PromiseLike<{
              data: { id: string; installation_job_id: string; storage_path: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from('installation_photos')
    .select('id, installation_job_id, storage_path')
    .eq('id', photoId)
    .maybeSingle();

  if (!photo) return { ok: false, error: '삭제할 사진이 없습니다.' };

  if (photo.storage_path) {
    const { error: removeError } = await client.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
    if (removeError) {
      // Storage 삭제 실패해도 메타행 삭제는 진행(관측만) — 고아 오브젝트는 수동 GC.
      log.warn('시공사진 Storage 삭제 실패(메타는 삭제 진행)', {
        path: photo.storage_path,
        error: removeError.message,
      });
    }
  }

  const { error: deleteError } = await (
    client as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from('installation_photos')
    .delete()
    .eq('id', photo.id);

  if (deleteError) return { ok: false, error: '사진 삭제에 실패했어요.' };

  revalidatePath(`/installations/${photo.installation_job_id}`);
  return { ok: true };
}

/** 사진 캡션 수정 (블로그 자산화용 설명). */
export async function updateInstallationPhotoCaptionAction(
  photoId: string,
  caption: string,
): Promise<PhotoActionResult> {
  await assertAdminRole(WRITE_ROLES);
  if (!isValidUuid(photoId)) return { ok: false, error: '잘못된 사진 ID입니다.' };

  const trimmed = caption.trim().slice(0, MAX_CAPTION);
  const client = await getServerClient();

  const { data, error } = await (
    client as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            select: (
              c: string,
            ) => PromiseLike<{ data: { installation_job_id: string }[] | null; error: { message: string } | null }>;
          };
        };
      };
    }
  )
    .from('installation_photos')
    .update({ caption: trimmed.length > 0 ? trimmed : null })
    .eq('id', photoId)
    .select('installation_job_id');

  if (error) return { ok: false, error: '캡션 저장에 실패했어요.' };
  if (data && data[0]) revalidatePath(`/installations/${data[0].installation_job_id}`);
  return { ok: true };
}
