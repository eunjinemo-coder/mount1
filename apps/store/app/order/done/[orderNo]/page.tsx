import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { CheckCircle2, Info } from 'lucide-react';
import type { ReactElement } from 'react';
import { formatCurrencyKRW, formatDateTimeKST } from '@mount/lib/format';
import { CopyButton } from '@/components/order/copy-account';
import { BANK_ACCOUNT, PAYMENT_DEADLINE_HOURS } from '@/lib/bank-info';
import { ORDER_SUMMARY_COOKIE, verifyOrderSummary } from '@/lib/order-summary-cookie';

interface PageProps {
  params: Promise<{ orderNo: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주문 완료',
  robots: { index: false, follow: false },
};

export default async function OrderDonePage({ params }: PageProps): Promise<ReactElement> {
  const { orderNo } = await params;

  // 금액·기한은 서버 발급 서명쿠키에서만 취득 → URL 위조로 금액 표시 불가.
  const cookieStore = await cookies();
  const token = cookieStore.get(ORDER_SUMMARY_COOKIE)?.value;
  const summary = verifyOrderSummary(token, orderNo);

  return (
    <main className="bg-background flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <div className="text-center">
          <div className="border-border mx-auto flex size-16 items-center justify-center rounded-full border">
            <CheckCircle2 className="text-success size-9" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-ko-tight">주문이 접수됐어요</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-7">
            아래 계좌로 입금해 주시면 확인 후 출고됩니다.
          </p>
        </div>

        {/* 주문번호 */}
        <div className="mt-8 rounded-2xl border border-border p-5 text-center">
          <p className="text-muted-foreground text-xs">주문번호</p>
          <p className="tabular mt-1 text-2xl font-bold tracking-wide">
            {orderNo}
            <CopyButton value={orderNo} label="주문번호 복사" />
          </p>
        </div>

        {/* 입금 안내 */}
        <div className="mt-4 rounded-2xl border border-border p-5">
          <h2 className="text-base font-bold">입금 안내</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">입금 은행</dt>
              <dd className="font-medium">{BANK_ACCOUNT.bankName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">계좌번호</dt>
              <dd className="tabular font-medium">
                {BANK_ACCOUNT.accountNo}
                <CopyButton value={BANK_ACCOUNT.accountNo} label="계좌번호 복사" />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">예금주</dt>
              <dd className="font-medium">{BANK_ACCOUNT.holder}</dd>
            </div>

            {summary ? (
              <>
                <div className="flex items-baseline justify-between gap-3 border-t border-input pt-2.5">
                  <dt className="text-muted-foreground">입금 금액</dt>
                  <dd className="tabular text-lg font-bold">{formatCurrencyKRW(summary.total)}</dd>
                </div>
                {summary.expiresAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">입금 기한</dt>
                    <dd className="font-medium">{formatDateTimeKST(summary.expiresAt)}</dd>
                  </div>
                )}
              </>
            ) : (
              <div className="border-t border-input pt-2.5">
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-5">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  입금 금액과 기한은 아래 <b>주문 조회</b>에서 확인해 주세요. (안내 정보 만료)
                </p>
              </div>
            )}
          </dl>
          {summary && (
            <p className="text-muted-foreground mt-3 text-xs leading-5">
              입금 기한은 주문 시각으로부터 {PAYMENT_DEADLINE_HOURS}시간입니다. 기한 내 미입금 시 주문이
              자동 취소될 수 있습니다.
            </p>
          )}
        </div>

        {/* SMS 안내 (R4 준비 중) */}
        <p className="border-border text-muted-foreground mt-4 rounded-xl border px-4 py-3 text-center text-xs leading-5">
          주문번호·계좌·금액을 SMS로도 보내드릴 예정입니다. (SMS 발송 준비 중)
        </p>

        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/order/lookup"
            className="border-input hover:bg-accent flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-colors"
          >
            주문 조회
          </Link>
          <Link
            href="/"
            className="text-muted-foreground flex h-12 items-center justify-center rounded-xl text-sm transition-colors"
          >
            스토어 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
