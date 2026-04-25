'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { submitCancelReportAction, type CancelCategory } from './actions';
import { SignaturePad } from './signature-pad';

export interface CancelFormProps {
  orderId: string;
}

const CATEGORY_OPTIONS: { value: CancelCategory; label: string; description: string }[] = [
  {
    value: 'no_drill_structural',
    label: '무타공 구조 불가',
    description: '벽 재질·두께·설치공간 등으로 무타공 시공 불가능',
  },
  {
    value: 'conversion_declined',
    label: '타공 전환 거부',
    description: '고객이 타공 전환에 동의하지 않음',
  },
  {
    value: 'customer_absent_3times',
    label: '고객 부재 (3회)',
    description: '연락 시도 3회 모두 실패. 부재 확인',
  },
  {
    value: 'address_issue',
    label: '주소 문제',
    description: '엘리베이터 진입 불가, 주소 오류, 접근 차단 등',
  },
  {
    value: 'tv_model_mismatch',
    label: 'TV 모델 불일치',
    description: '주문 TV 와 실제 TV 가 다름 (사이즈·VESA 규격)',
  },
  { value: 'etc', label: '기타', description: '위 사유에 해당하지 않는 경우 (상세 작성 필수)' },
];

export function CancelForm(props: CancelFormProps): ReactElement {
  const router = useRouter();
  const [category, setCategory] = useState<CancelCategory>('no_drill_structural');
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">취소 사유</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              key={opt.value}
            >
              <input
                checked={category === opt.value}
                className="mt-1"
                name="category"
                onChange={() => setCategory(opt.value)}
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">현장 상황 (필수 · 10자 이상)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground min-h-32 w-full rounded-md border px-3 py-2 text-sm"
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="예: 거실 벽이 콘크리트 + 단열재 90mm. 무타공 마운트 안전 부착 어려움. 고객에게 타공 전환 안내했으나 임차인이라 거부."
            value={note}
          />
          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
            <span className={note.trim().length < 10 ? 'text-destructive' : ''}>
              {note.trim().length < 10 ? `${10 - note.trim().length}자 더 필요` : '충분합니다'}
            </span>
            <span>{note.length} / 200자</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">기사 서명 (필수)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            본인 책임 하에 작성됨을 확인하는 서명입니다. 본사 검토 후 쿠팡 전달용 자료가 됩니다.
          </p>
          <SignaturePad onChange={setSignature} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">사진 증빙</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>
            현장 사진은 <span className="text-foreground font-semibold">[/order/{props.orderId}/photos]</span> 화면에서 업로드 후 본 리포트에 자동 첨부됩니다 (R6 통합 예정).
          </p>
        </CardContent>
      </Card>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={isPending || note.trim().length < 10 || !signature}
        onClick={() => {
          if (!signature) {
            setError('기사 서명을 입력해 주세요.');
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await submitCancelReportAction({
              orderId: props.orderId,
              category,
              situationNote: note,
              signaturePlaceholder: signature,
            });
            if (result.ok) {
              router.push('/today');
            } else if (result.error) {
              setError(result.error);
            }
          });
        }}
        size="lg"
        variant="destructive"
      >
        {isPending ? '제출 중…' : '취소 리포트 제출'}
      </Button>
    </div>
  );
}
