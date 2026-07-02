import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactElement } from 'react';
import { QuoteForm } from '@/components/quote/quote-form';

export const metadata: Metadata = {
  title: '대량 견적 문의',
  description:
    '무타공 TV 벽걸이 브라켓 대량·정기 발주 견적 문의 — 벽걸이프로 공식 스토어. 팔레트 단위 별도 도매 단가 안내.',
  openGraph: {
    title: '대량 견적 문의 · 벽걸이프로 스토어',
    description: '팔레트 단위·정기 발주 별도 도매 단가를 안내해 드립니다.',
  },
};

export default function QuotePage(): ReactElement {
  return (
    <main className="bg-background min-h-dvh">
      <div className="mx-auto max-w-lg px-5 pb-16">
        <div className="pt-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden />
            스토어로
          </Link>
        </div>

        <header className="pt-6">
          <h1 className="text-2xl font-bold tracking-ko-tight">대량 견적 문의</h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-7">
            팔레트 단위나 정기 발주는 화면 단가보다 낮은 별도 도매가를 드립니다. 아래 정보를 남겨주시면
            담당자가 회신드립니다.
          </p>
        </header>

        <div className="mt-8">
          <QuoteForm />
        </div>
      </div>
    </main>
  );
}
