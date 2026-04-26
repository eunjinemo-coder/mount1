'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { Phone, PhoneCall } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { getCustomerPhoneAction, logPreCallAction, type CallOutcome } from './actions';

export interface PreCallFormProps {
  orderId: string;
  phoneTail4: string;
}

const OUTCOME_OPTIONS: { value: CallOutcome; label: string; description: string }[] = [
  { value: 'answered', label: '통화 완료', description: '고객과 통화 완료. 도착 안내 마침.' },
  { value: 'no_answer', label: '부재중', description: '신호는 갔으나 받지 않음.' },
  { value: 'busy', label: '통화 중', description: '다른 통화 중. 잠시 후 재시도.' },
  { value: 'unreachable', label: '연결 안됨', description: '결번 / 전원꺼짐 / 통신 불가.' },
  {
    value: 'manual_marked_done',
    label: '수동 완료',
    description: '문자·카톡 등 다른 수단으로 안내 완료.',
  },
  {
    value: 'customer_postponed',
    label: '고객 연기 요청',
    description: '고객이 일정 변경 요청. 본사 카카오톡 채널로 새 일정 보고 필요.',
  },
  {
    value: 'customer_cancelled',
    label: '고객 취소 요청',
    description: '고객이 전화로 취소 의사 표현. 저장 후 자동으로 취소 리포트 화면 안내.',
  },
];

export function PreCallForm(props: PreCallFormProps): ReactElement {
  const router = useRouter();
  const [outcome, setOutcome] = useState<CallOutcome>('answered');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDialing, startDial] = useTransition();

  const handleDial = (): void => {
    setError(null);
    startDial(async () => {
      const result = await getCustomerPhoneAction(props.orderId);
      if (result.ok && result.phone) {
        // tel: 딥링크 — iOS/Android 기본 다이얼러 호출. 평문은 메모리에서만 사용 후 폐기.
        window.location.href = `tel:${result.phone.replace(/[^\d+]/g, '')}`;
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" />
            고객 연락처
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-base">***-****-{props.phoneTail4 || '????'}</p>
          <Button
            className="w-full"
            disabled={isDialing}
            onClick={handleDial}
            type="button"
            variant="outline"
          >
            <PhoneCall className="mr-2 size-4" />
            {isDialing ? '연결 중…' : '전화 걸기'}
          </Button>
          <p className="text-muted-foreground text-xs">
            버튼을 누르는 즉시 단말기 다이얼러로 연결됩니다. 통화 후 아래 결과를 저장해 주세요.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">통화 결과</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              key={opt.value}
            >
              <input
                checked={outcome === opt.value}
                className="mt-1"
                name="outcome"
                onChange={() => setOutcome(opt.value)}
                type="radio"
                value={opt.value}
              />
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-muted-foreground text-sm">{opt.description}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await logPreCallAction({ orderId: props.orderId, outcome });
            if (result.ok) {
              // 고객 취소 요청 → 자동으로 취소 리포트 화면 진입 (와이어 A05 분기)
              if (outcome === 'customer_cancelled') {
                router.push(`/order/${props.orderId}/cancel`);
              } else {
                router.push(`/order/${props.orderId}`);
              }
            } else if (result.error) {
              setError(result.error);
            }
          });
        }}
        size="lg"
      >
        {isPending ? '저장 중…' : '통화 기록 저장'}
      </Button>
    </div>
  );
}
