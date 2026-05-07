'use client';

import { Button, Card, CardContent } from '@mount/ui';
import { useState, useTransition, type ReactElement } from 'react';
import { createIssueAction } from './issue-form-action';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'no_drill_impossible', label: '무타공 불가' },
  { value: 'customer_absent', label: '고객 부재' },
  { value: 'address_inaccessible', label: '접근 불가' },
  { value: 'tv_model_mismatch', label: 'TV 불일치' },
  { value: 'wall_damage_found', label: '벽면 손상' },
  { value: 'etc', label: '기타' },
];

interface Props {
  orderId: string;
}

export function IssueForm({ orderId }: Props): ReactElement {
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const r = await createIssueAction({ orderId, category, note });
      if (r.ok) {
        setSuccess(true);
        setNote('');
        setCategory('');
      } else if (r.error) {
        setError(r.error);
      }
    });
  };

  return (
    <Card className="border-amber-300 bg-amber-50/30">
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm font-semibold">새 이슈 작성</p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-md border px-2 py-2 text-xs ${
                category === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="현장 상황을 구체적으로 입력해 주세요."
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        {success ? (
          <p className="text-xs text-emerald-700">✓ 이슈가 본사에 전달되었습니다.</p>
        ) : null}
        <Button
          onClick={submit}
          disabled={!category || !note.trim() || isPending}
          className="w-full"
          size="sm"
        >
          {isPending ? '전송 중…' : '이슈 보고'}
        </Button>
      </CardContent>
    </Card>
  );
}
