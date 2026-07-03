'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { AlertCircle, CheckCircle2, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { confirmStorePaymentAction, registerStoreShipmentAction } from '@/app/(admin)/store/actions';
import { CARRIER_CODES } from '@/lib/store/shipment';
import { ConfirmDialog } from '../confirm-dialog';
import { CARRIER_LABEL } from '../../_lib/labels';

export function PaymentShipmentCard({
  orderId,
  orderNo,
  status,
}: {
  orderId: string;
  orderNo: string;
  status: string;
}): ReactElement | null {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [carrier, setCarrier] = useState<string>(CARRIER_CODES[0]);
  const [trackingNo, setTrackingNo] = useState('');

  if (status !== 'awaiting_payment' && status !== 'paid') return null;

  const confirmPayment = (): void => {
    setError(null);
    setConfirmOpen(false);
    startTransition(async () => {
      const r = await confirmStorePaymentAction(orderId);
      if (r.ok) router.refresh();
      else setError(r.error ?? '입금확인에 실패했습니다.');
    });
  };

  const registerShipment = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await registerStoreShipmentAction(orderId, carrier, trackingNo);
      if (r.ok) {
        setTrackingNo('');
        router.refresh();
      } else {
        setError(r.error ?? '운송장 등록에 실패했습니다.');
      }
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">주문 처리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'awaiting_payment' ? (
          <>
            <Button className="w-full" disabled={isPending} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 className="mr-2 size-4" aria-hidden />
              {isPending ? '처리 중…' : '입금확인'}
            </Button>
            <ConfirmDialog
              description="구매자에게 SMS/알림톡이 발송됩니다."
              isPending={isPending}
              onConfirm={confirmPayment}
              onOpenChange={setConfirmOpen}
              open={confirmOpen}
              title={`${orderNo} 입금확인`}
            />
          </>
        ) : null}

        {status === 'paid' ? (
          <div className="space-y-3">
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              onChange={(e) => setCarrier(e.target.value)}
              value={carrier}
            >
              {CARRIER_CODES.map((code) => (
                <option key={code} value={code}>
                  {CARRIER_LABEL[code] ?? code}
                </option>
              ))}
            </select>
            <input
              className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="운송장 번호"
              value={trackingNo}
            />
            <Button
              className="w-full"
              disabled={isPending || trackingNo.trim().length === 0}
              onClick={registerShipment}
            >
              <Truck className="mr-2 size-4" aria-hidden />
              {isPending ? '등록 중…' : '운송장 입력'}
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="border-destructive/30 flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm">
            <AlertCircle className="text-destructive size-4 shrink-0" aria-hidden />
            <p className="text-destructive">{error}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
