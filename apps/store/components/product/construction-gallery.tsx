import type { ReactElement } from 'react';
import type { GalleryItem } from '@/lib/dummy-products';
import { GalleryPlaceholder } from './gallery-placeholder';

interface Props {
  items: GalleryItem[];
}

/**
 * 시공 사진 갤러리.
 * TODO(실자료): 현재는 중립 GalleryPlaceholder. 실 시공 사진 수령 시
 *   <GalleryPlaceholder /> 자리를 next/image <Image src={photo}/> 로 교체(figure/figcaption 재사용).
 */
export function ConstructionGallery({ items }: Props): ReactElement {
  return (
    <section className="px-5">
      <h2 className="text-xl font-bold tracking-ko-tight">현장에서 이렇게 걸립니다</h2>
      <p className="text-muted-foreground mt-2 text-[15px] leading-7">
        거실·침실·상업 공간까지, 무타공으로 마감한 실제 시공 예시입니다.
      </p>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <li key={item.caption}>
            <figure>
              <div className="border-border relative aspect-[4/3] w-full overflow-hidden rounded-2xl border">
                <GalleryPlaceholder />
              </div>
              <figcaption className="text-muted-foreground mt-2 text-xs leading-5">
                {item.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {/* TODO(실자료): 실 시공 사진으로 교체 시 이 안내 문구 삭제 */}
      <p className="text-muted-foreground/70 mt-3 text-[11px] leading-5">
        ※ 시공 예시 이미지입니다. 실제 시공 사진으로 순차 교체 예정입니다.
      </p>
    </section>
  );
}
