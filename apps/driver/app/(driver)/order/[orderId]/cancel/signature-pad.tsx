'use client';

import { Button } from '@mount/ui';
import { Eraser, Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

/**
 * 자체 구현 서명 캔버스 (외부 패키지 없이) — Canvas API + Pointer Events.
 * - 검정 펜, 굵기 2px
 * - 비어있으면 onChange(null), 서명 후 onChange(dataUrl PNG)
 * - "지우기" 버튼
 */
export function SignaturePad(props: SignaturePadProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 고해상도 디스플레이 대응 (DPR 2x)
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
  }, []);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = getPoint(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPoint.current) return;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    if (!hasSignature) setHasSignature(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (hasSignature) {
      props.onChange(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    props.onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="border-input bg-card relative h-40 w-full rounded-md border-2">
        <canvas
          className="h-full w-full touch-none"
          onPointerCancel={end}
          onPointerDown={start}
          onPointerLeave={end}
          onPointerMove={move}
          onPointerUp={end}
          ref={canvasRef}
          style={{ touchAction: 'none' }}
        />
        {!hasSignature ? (
          <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Pencil className="size-4" />
            여기에 서명해 주세요
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button disabled={!hasSignature} onClick={clear} size="sm" type="button" variant="ghost">
          <Eraser className="size-3" />
          지우기
        </Button>
      </div>
    </div>
  );
}
