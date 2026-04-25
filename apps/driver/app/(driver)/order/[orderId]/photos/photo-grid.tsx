'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Camera, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState, useTransition, type ReactElement } from 'react';
import { deletePhotoAction, uploadPhotoAction } from './actions';

export interface PhotoSlotData {
  slot: string;
  label: string;
  uploaded: boolean;
  path: string | null;
  signedUrl: string | null;
}

export interface PhotoGridProps {
  orderId: string;
  phase: string;
  slots: PhotoSlotData[];
}

export function PhotoGrid(props: PhotoGridProps): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{props.phase}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {props.slots.map((slot) => (
          <PhotoSlot key={slot.slot} orderId={props.orderId} slot={slot} />
        ))}
      </CardContent>
    </Card>
  );
}

function PhotoSlot({ orderId, slot }: { orderId: string; slot: PhotoSlotData }): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploaded, setUploaded] = useState(slot.uploaded);

  const triggerSelect = () => inputRef.current?.click();

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('slot', slot.slot);
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadPhotoAction(formData);
      if (result.ok) {
        setUploaded(true);
      } else if (result.error) {
        setError(result.error);
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const onDelete = () => {
    if (!confirm('이 사진을 삭제할까요?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePhotoAction(orderId, slot.slot);
      if (result.ok) {
        setUploaded(false);
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        className={`relative flex h-32 flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 border-dashed transition-colors ${
          uploaded ? 'border-success' : 'border-input hover:border-primary hover:bg-muted/40'
        }`}
        disabled={isPending}
        onClick={triggerSelect}
        type="button"
      >
        {isPending ? (
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        ) : uploaded && slot.signedUrl ? (
          <>
            <img
              alt={slot.label}
              className="absolute inset-0 size-full object-cover"
              src={slot.signedUrl}
            />
            <span className="bg-success/90 text-success-foreground absolute right-1 bottom-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
              <CheckCircle2 className="size-3" />
              완료
            </span>
          </>
        ) : uploaded ? (
          <>
            <CheckCircle2 className="text-success size-6" />
            <span className="text-success text-xs font-medium">업로드 완료</span>
          </>
        ) : (
          <>
            <Camera className="text-muted-foreground size-6" />
            <span className="text-muted-foreground text-xs">{slot.label}</span>
          </>
        )}
      </button>

      <input
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
        ref={inputRef}
        type="file"
      />

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{slot.label}</span>
        {uploaded ? (
          <Button
            disabled={isPending}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-3" />
            삭제
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
