'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { completeInstallationAction } from './actions';

export interface CompleteFormProps {
  orderId: string;
  status: string;
}

export function CompleteForm(props: CompleteFormProps): ReactElement {
  const router = useRouter();

  // T4.2 — 무타공/타공 전환 토글
  const [conversion, setConversion] = useState(false);
  const optionSelected = conversion ? 'B_drill' : 'C_no_drill';

  // T4.3 — 고객 동의 체크박스
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAllowed =
    props.status === 'assigned' ||
    props.status === 'en_route' ||
    props.status === 'on_site' ||
    props.status === 'in_progress';

  return (
    <div className="space-y-4">
      {/* T4.2 — 시공 결과 토글 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">시공 결과</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3">
            <div>
              {conversion ? (
                <>
                  <p className="font-medium text-amber-700">타공 전환 완료</p>
                  <p className="text-muted-foreground text-sm">현장 합의로 타공 전환된 경우만</p>
                </>
              ) : (
                <>
                  <p className="font-medium">무타공 완료</p>
                  <p className="text-muted-foreground text-sm">계획대로 무타공 시공 완료.</p>
                </>
              )}
            </div>
            {/* Toggle switch — native checkbox styled as toggle */}
            <div className="relative flex-shrink-0">
              <input
                checked={conversion}
                className="peer sr-only"
                id="conversion-toggle"
                onChange={(e) => setConversion(e.target.checked)}
                type="checkbox"
              />
              <label
                className={[
                  'flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
                  conversion ? 'bg-amber-500' : 'bg-muted',
                ].join(' ')}
                htmlFor="conversion-toggle"
              >
                <span
                  className={[
                    'ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    conversion ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </label>
            </div>
          </label>
          {conversion ? (
            <p className="text-muted-foreground mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              타공 전환 선택됨 — 차액은 본사가 고객에게 자동 청구합니다.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* T4.3 — 고객 동의 체크박스 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <input
              checked={consentConfirmed}
              className="accent-primary mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer"
              id="consent"
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              type="checkbox"
            />
            <label className="cursor-pointer text-sm leading-tight" htmlFor="consent">
              <p className="font-medium">고객 동의 확인 (신분증·결제 안내)</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                체크하지 않은 경우 본사 검수가 자동 알림을 받습니다.
              </p>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 메모 입력 (선택) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">메모 (선택)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            onChange={(e) => setMemo(e.target.value)}
            placeholder="특이사항이 있으면 입력해 주세요."
            rows={3}
            value={memo}
          />
        </CardContent>
      </Card>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      {!isAllowed ? (
        <p className="text-muted-foreground text-sm">
          현재 상태: <strong>{props.status}</strong> · 완료 처리가 불가한 상태입니다.
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={!isAllowed || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await completeInstallationAction({
              orderId: props.orderId,
              optionSelected,
              conversion,
              consentConfirmed,
              memo: memo || undefined,
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
