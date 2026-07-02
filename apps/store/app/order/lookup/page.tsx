import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactElement } from 'react';
import { LookupForm } from '@/components/order/lookup-form';

export const metadata: Metadata = {
  title: '주문 조회',
  description: '주문번호와 휴대폰 번호로 주문 상태를 조회합니다.',
  robots: { index: false, follow: false },
};

export default function LookupPage(): ReactElement {
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
          <h1 className="text-2xl font-bold tracking-ko-tight">주문 조회</h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-7">
            주문 시 받으신 주문번호와 휴대폰 번호를 입력하시면 진행 상태를 확인하실 수 있습니다.
          </p>
        </header>

        <div className="mt-8">
          <LookupForm />
        </div>
      </div>
    </main>
  );
}
