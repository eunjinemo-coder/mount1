'use client';

import { Button } from '@mount/ui';
import { useState, useTransition, type ReactElement } from 'react';
import { respondToIssueAction } from './issue-response-action';

interface Props {
  issueId: string;
  orderId: string;
}

export function IssueResponseForm({ issueId, orderId }: Props): ReactElement {
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const r = await respondToIssueAction({ issueId, orderId, responseText });
      if (r.ok) {
        setSuccess(true);
        setResponseText('');
      } else if (r.error) {
        setError(r.error);
      }
    });
  };

  if (success) {
    return (
      <p className="mt-2 text-xs text-emerald-700">✓ 응답이 전송되었습니다. 새로고침하면 반영됩니다.</p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        placeholder="기사에게 전달할 응답을 입력해 주세요."
        rows={2}
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
      />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button
        size="sm"
        disabled={!responseText.trim() || isPending}
        onClick={submit}
      >
        {isPending ? '전송 중…' : '응답 보내기'}
      </Button>
    </div>
  );
}
