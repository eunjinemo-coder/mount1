'use client';

import { Button } from '@mount/ui';
import { Camera, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactElement } from 'react';
import { deletePhotoByIdAction, uploadPhotoAction } from './actions';
import { compressToWebP, extractExif } from './image-utils';

export interface PhotoItem {
  id: string;
  slot: string;
  signedUrl: string | null;
}

export interface PhotoUploaderProps {
  orderId: string;
  photos: PhotoItem[];
}

/**
 * 시공 사진 통합 업로더 — multi-file 한 번에 선택, 'extra' 슬롯에 전부 INSERT.
 * 슬롯 구분 없이 시공 사진 N장.
 */
export function PhotoUploader({ orderId, photos }: PhotoUploaderProps): ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onFilesChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setProgress({ done: 0, total: files.length });

    startTransition(async () => {
      let successCount = 0;
      const errors: string[] = [];

      for (const [index, file] of files.entries()) {
        try {
          const exif = await extractExif(file);
          let toUpload: File = file;
          let width = 0;
          let height = 0;
          try {
            const r = await compressToWebP(file);
            toUpload = r.file;
            width = r.width;
            height = r.height;
          } catch {
            // 압축 실패해도 원본 업로드 시도
          }

          const formData = new FormData();
          formData.append('orderId', orderId);
          formData.append('slot', 'extra');
          formData.append('file', toUpload);
          if (width > 0) formData.append('width', String(width));
          if (height > 0) formData.append('height', String(height));
          if (exif.takenAt) formData.append('takenAt', exif.takenAt);
          if (exif.takenLat != null) formData.append('takenLat', String(exif.takenLat));
          if (exif.takenLng != null) formData.append('takenLng', String(exif.takenLng));

          const result = await uploadPhotoAction(formData);
          if (result.ok) {
            successCount++;
          } else if (result.error) {
            errors.push(result.error);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[photo-uploader] upload error:', e);
          errors.push(msg.slice(0, 80));
        }
        setProgress({ done: index + 1, total: files.length });
      }

      if (errors.length > 0) {
        setError(`${successCount}/${files.length} 업로드 완료. 실패 ${errors.length}건: ${errors[0]}`);
      }
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    });
  };

  const onDelete = (photoId: string): void => {
    if (!confirm('이 사진을 삭제할까요?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePhotoByIdAction(photoId);
      if (result.ok) {
        router.refresh();
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        size="lg"
        variant="outline"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {progress ? `${progress.done}/${progress.total} 업로드 중…` : '처리 중…'}
          </>
        ) : (
          <>
            <Camera className="mr-2 size-4" />
            사진 추가 (여러 장 선택 가능)
          </>
        )}
      </Button>

      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        multiple
        onChange={onFilesChange}
        ref={inputRef}
        type="file"
      />

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div
              className="relative aspect-square overflow-hidden rounded-md border"
              key={p.id}
            >
              {p.signedUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  alt="시공 사진"
                  className="size-full object-cover"
                  src={p.signedUrl}
                />
              ) : (
                <div className="bg-muted flex size-full items-center justify-center">
                  <CheckCircle2 className="text-success size-6" />
                </div>
              )}
              <button
                aria-label="사진 삭제"
                className="bg-destructive text-destructive-foreground absolute right-1 top-1 rounded-full p-1 shadow"
                disabled={isPending}
                onClick={() => onDelete(p.id)}
                type="button"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          등록된 시공 사진이 없습니다. 위 버튼으로 추가해 주세요.
        </p>
      )}
    </div>
  );
}
