import { ShieldCheck } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * S1 홈 히어로 — 브랜드 미션 한 줄 + 무타공 수요 프레이밍.
 * 홈은 상세로 보내는 관문이므로 간결하게.
 */
export function HomeHero(): ReactElement {
  return (
    <section className="px-5 pt-14 pb-10 text-center">
      <p className="text-primary text-sm font-semibold">벽걸이프로</p>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-ko-tight">
        어차피 하실 무타공,
        <br />
        브라켓은 제대로 된 걸 쓰세요
      </h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-xs text-[15px] leading-7">
        단가 높은 무타공 시공, 자재 하자로 재방문하면 남는 게 없습니다. 현장에서 검증된 무타공
        브라켓을 도매가로 공급합니다.
      </p>
      <div className="text-muted-foreground mt-6 inline-flex items-center gap-1.5 text-xs">
        <ShieldCheck className="text-primary size-4" aria-hidden />
        <span>자재 하자 1년 무상 교체 · 전국 익영업일 출고</span>
      </div>
    </section>
  );
}
