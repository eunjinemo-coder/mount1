'use client';

import exifr from 'exifr';

const MAX_DIMENSION = 1920;
const QUALITY = 0.85;
const SKIP_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // WebP & 1.5MB 미만이면 그대로

interface CompressResult {
  file: File;
  width: number;
  height: number;
  /** 원본 대비 압축률 (0~1) — 1이면 변환 skip */
  ratio: number;
}

export interface ExifMeta {
  takenAt: string | null;
  takenLat: number | null;
  takenLng: number | null;
}

/**
 * 클라 측 EXIF 추출 — 촬영 시간 + GPS 좌표만.
 * exifr 가 EXIF segment 만 읽음 (전체 디코드 X, 빠름).
 * 실패해도 throw 없이 null 반환 (사진 업로드 막지 않음).
 */
export async function extractExif(file: File): Promise<ExifMeta> {
  if (!file.type.startsWith('image/')) {
    return { takenAt: null, takenLat: null, takenLng: null };
  }
  try {
    const data = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude'],
    });
    if (!data) return { takenAt: null, takenLat: null, takenLng: null };

    const taken =
      (data.DateTimeOriginal as Date | undefined) ?? (data.CreateDate as Date | undefined);
    const lat = typeof data.GPSLatitude === 'number' ? data.GPSLatitude : null;
    const lng = typeof data.GPSLongitude === 'number' ? data.GPSLongitude : null;

    return {
      takenAt: taken instanceof Date ? taken.toISOString() : null,
      takenLat: lat,
      takenLng: lng,
    };
  } catch {
    return { takenAt: null, takenLat: null, takenLng: null };
  }
}

async function blobFromCanvas(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/webp', quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas_blob_failed'))),
      'image/webp',
      quality,
    );
  });
}

/**
 * 클라이언트 측 이미지 리사이즈 + WebP 변환.
 * - 긴 변 1920px 까지 축소 (촬영 원본은 보통 4000px+ → 70%+ 절감)
 * - WebP quality 0.85 (시각적 손실 미미)
 * - 이미 WebP + 1.5MB 미만이면 변환 skip
 * - createImageBitmap / OffscreenCanvas 미지원 환경 자동 fallback
 */
export async function compressToWebP(input: File): Promise<CompressResult> {
  if (input.type === 'image/webp' && input.size < SKIP_THRESHOLD_BYTES) {
    const dim = await readImageSize(input);
    return { file: input, width: dim.width, height: dim.height, ratio: 1 };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input);
  } catch {
    // 일부 iOS 구버전 등 — fallback 없이 원본 사용
    return { file: input, width: 0, height: 0, ratio: 1 };
  }

  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > MAX_DIMENSION ? MAX_DIMENSION / longSide : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(w, h);
  } else {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    canvas = el;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { file: input, width: bitmap.width, height: bitmap.height, ratio: 1 };
  }
  // OffscreenCanvas / HTMLCanvasElement 의 ctx 양쪽 호환 — drawImage 시그니처 동일
  (ctx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D).drawImage(bitmap, 0, 0, w, h);

  const blob = await blobFromCanvas(canvas, QUALITY);
  bitmap.close();

  // 원본보다 커진 경우 (작은 이미지 + WebP 헤더 오버헤드) 원본 유지
  if (blob.size >= input.size) {
    return { file: input, width: bitmap.width, height: bitmap.height, ratio: 1 };
  }

  const newName = input.name.replace(/\.[^.]+$/, '') + '.webp';
  const compressed = new File([blob], newName, {
    type: 'image/webp',
    lastModified: Date.now(),
  });

  return {
    file: compressed,
    width: w,
    height: h,
    ratio: blob.size / input.size,
  };
}

async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bm = await createImageBitmap(file);
    const dim = { width: bm.width, height: bm.height };
    bm.close();
    return dim;
  } catch {
    return { width: 0, height: 0 };
  }
}
