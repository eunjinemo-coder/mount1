'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { completeInstallationAction, type CompleteVariant, type ConversionMethod } from './actions';

export interface CompleteFormProps {
  orderId: string;
  priceB: number;
  priceC: number;
  status: string;
}

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' });

export function CompleteForm(props: CompleteFormProps): ReactElement {
  const router = useRouter();
  const [variant, setVariant] = useState<CompleteVariant>('no_drill');
  const [method, setMethod] = useState<ConversionMethod>('verbal');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInProgress = props.status === 'in_progress';
  const conversionDiff = props.priceB - props.priceC;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">시공 결과</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              checked={variant === 'no_drill'}
              className="mt-1"
              name="variant"
              onChange={() => setVariant('no_drill')}
              type="radio"
              value="no_drill"
            />
            <div>
              <p className="font-medium">무타공 완료</p>
              <p className="text-muted-foreground text-sm">계획대로 무타공 시공 완료. 추가 결제 없음.</p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              checked={variant === 'drill_converted'}
              className="mt-1"
              name="variant"
              onChange={() => setVariant('drill_converted')}
              type="radio"
              value="drill_converted"
            />
            <div className="flex-1">
              <p className="font-medium">타공 전환 완료</p>
              <p className="text-muted-foreground text-sm">
                현장 판단으로 타공 시공. 차액{' '}
                <span className="text-foreground font-semibold tabular-nums">
                  {KRW_FORMATTER.format(conversionDiff)}
                </span>{' '}
                자동 청구.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {variant === 'drill_converted' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">합의 방법</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              onChange={(event) => setMethod(event.target.value as ConversionMethod)}
              value={method}
            >
              <option value="verbal">현장 구두 합의</option>
              <option value="sms">SMS 회신 동의</option>
              <option value="phone">전화 동의 (녹취)</option>
            </select>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      {!isInProgress ? (
        <p className="text-muted-foreground text-sm">
          현재 상태: <strong>{props.status}</strong> · 완료는 시공 시작 후 가능합니다.
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={!isInProgress || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await completeInstallationAction({
              orderId: props.orderId,
              variant,
              conversionMethod: variant === 'drill_converted' ? method : undefined,
            });
            if (result.ok) {
              router.push('/today');
            } else if (result.error) {
              setError(result.error);
            }
          });
        }}
        size="lg"
      >
        {isPending ? '완료 처리 중…' : '시공 완료'}
      </Button>
    </div>
  );
}
