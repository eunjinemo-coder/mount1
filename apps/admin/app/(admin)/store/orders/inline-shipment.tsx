'use client';

/**
 * A2(목록) 인라인 운송장 입력 — paid 주문을 A3 상세로 이동하지 않고 그 자리에서 처리.
 * 은진님이 하루 수십 번 반복하는 루프의 핵심 개선(팀리드 지시 §1): 택배사는
 * localStorage('store:lastCarrier')에 기억해 다음 입력부터 기본값으로 채운다.
 */
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@mount/ui';
import { Truck } from 'lucide-react';
import { useEffect, useState, useTransition, type ReactElement } from 'react';
import type { StoreActionResult } from '@/lib/store/payment';
import { CARRIER_CODES } from '@/lib/store/shipment';
import { CARRIER_LABEL } from '../_lib/labels';
import { registerStoreShipmentAction } from '../actions';

const LAST_CARRIER_KEY = 'store:lastCarrier';

export function InlineShipment({
  orderId,
  orderNo,
  status,
  onDone,
}: {
  orderId: string;
  orderNo: string;
  status: string;
  onDone: (result: StoreActionResult, successMessage: string) => void;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState<string>(CARRIER_CODES[0]);
  const [trackingNo, setTrackingNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 모달을 열 때마다 마지막으로 쓴 택배사를 다시 읽는다(다른 탭/행에서 바뀌었을 수 있음).
  useEffect(() => {
    if (!open) return;
    const saved = window.localStorage.getItem(LAST_CARRIER_KEY);
    if (saved && (CARRIER_CODES as readonly string[]).includes(saved)) setCarrier(saved);
  }, [open]);

  if (status !== 'paid') return null;

  const handleCarrierChange = (value: string): void => {
    setCarrier(value);
    window.localStorage.setItem(LAST_CARRIER_KEY, value);
  };

  const handleSubmit = (): void => {
    setError(null);
    startTransition(async () => {
      const r = await registerStoreShipmentAction(orderId, carrier, trackingNo);
      if (r.ok) {
        setOpen(false);
        setTrackingNo('');
        onDone(r, '운송장 등록 완료');
      } else {
        setError(r.error ?? '운송장 등록에 실패했습니다.');
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <Truck className="mr-1 size-3" aria-hidden />
        운송장
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{orderNo} 운송장 입력</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              onChange={(e) => handleCarrierChange(e.target.value)}
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
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button disabled={isPending} onClick={() => setOpen(false)} variant="outline">
              취소
            </Button>
            <Button disabled={isPending || trackingNo.trim().length === 0} onClick={handleSubmit}>
              {isPending ? '등록 중…' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
