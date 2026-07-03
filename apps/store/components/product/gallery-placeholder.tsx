import { ImageIcon } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * 시공 사진 자리 플레이스홀더 — 단색 중립 박스 + 중앙 아이콘.
 * TODO(실자료): 실 시공 사진 수령 시 이 컴포넌트 대신 next/image <Image>로 교체.
 *   ConstructionGallery 의 <GalleryPlaceholder /> 자리를 <Image src={photo}/> 로 바꾸면 된다.
 *
 * 순수 표현용이므로 aria-hidden — 의미(캡션)는 상위 figure/figcaption 이 전달.
 */
export function GalleryPlaceholder(): ReactElement {
  return (
    <div className="bg-muted flex h-full w-full items-center justify-center" aria-hidden>
      <ImageIcon className="text-muted-foreground/40 size-8" />
    </div>
  );
}
