'use client';

/**
 * 시공 사진 갤러리 + 업로드(클라이언트) — 완료사진 등록/삭제/캡션.
 * 어드민 정숙 규율: 흰 배경 + 헤어라인, 장식 없이 사진·설명만.
 *
 * url 은 서버(page.tsx)에서 photos-hot 서명 URL 로 생성해 내려준다(버킷 비공개).
 */
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactElement } from 'react';
import {
  deleteInstallationPhotoAction,
  updateInstallationPhotoCaptionAction,
  uploadInstallationPhotoAction,
} from './photos-actions';

export interface InstallationPhotoView {
  id: string;
  url: string | null;
  caption: string | null;
}

export interface InstallationPhotosProps {
  jobId: string;
  photos: InstallationPhotoView[];
  canWrite: boolean;
}

export function InstallationPhotos({ jobId, photos, canWrite }: InstallationPhotosProps): ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function onPick(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setError(null);
    startTransition(async () => {
      let done = 0;
      for (const file of list) {
        setProgress(`업로드 중… (${done + 1}/${list.length})`);
        const fd = new FormData();
        fd.set('jobId', jobId);
        fd.set('file', file);
        const res = await uploadInstallationPhotoAction(fd);
        if (!res.ok) {
          setError(res.error ?? '업로드 실패');
          break;
        }
        done += 1;
      }
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    });
  }

  function onDelete(photoId: string): void {
    setError(null);
    startTransition(async () => {
      const res = await deleteInstallationPhotoAction(photoId);
      if (!res.ok) {
        setError(res.error ?? '삭제 실패');
        return;
      }
      router.refresh();
    });
  }

  function saveCaption(photoId: string, next: string, prev: string): void {
    if (next.trim() === (prev ?? '').trim()) return;
    startTransition(async () => {
      const res = await updateInstallationPhotoCaptionAction(photoId, next);
      if (!res.ok) setError(res.error ?? '캡션 저장 실패');
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          시공 사진 <span className="text-muted-foreground font-normal">({photos.length})</span>
        </CardTitle>
        {canWrite ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? (progress ?? '처리 중…') : '사진 추가'}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {photos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            등록된 시공 사진이 없습니다.{canWrite ? ' 오른쪽 위 “사진 추가”로 올려 주세요.' : ''}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((p) => (
              <figure key={p.id} className="space-y-2">
                <div className="bg-muted relative overflow-hidden rounded-md border">
                  {p.url ? (
                    <img
                      src={p.url}
                      alt={p.caption ?? '시공 사진'}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-muted-foreground flex aspect-square w-full items-center justify-center text-xs">
                      미리보기 불가
                    </div>
                  )}
                </div>
                {canWrite ? (
                  <>
                    <Input
                      defaultValue={p.caption ?? ''}
                      placeholder="설명(블로그용)"
                      className="h-8 text-xs"
                      onBlur={(e) => saveCaption(p.id, e.target.value, p.caption ?? '')}
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onDelete(p.id)}
                      className="text-muted-foreground hover:text-destructive text-xs underline"
                    >
                      삭제
                    </button>
                  </>
                ) : p.caption ? (
                  <figcaption className="text-muted-foreground text-xs">{p.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
