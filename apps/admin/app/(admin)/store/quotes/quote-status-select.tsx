'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { QUOTE_STATUS_LABEL } from '../_lib/labels';
import { updateQuoteStatusAction } from './actions';

const OPTIONS = ['new', 'contacted', 'closed'] as const;

export function QuoteStatusSelect({
  quoteId,
  status,
}: {
  quoteId: string;
  status: string;
}): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handle = (nextStatus: string): void => {
    setError(null);
    startTransition(async () => {
      const r = await updateQuoteStatusAction(quoteId, nextStatus);
      if (r.ok) router.refresh();
      else setError(r.error ?? '실패했습니다.');
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        className="border-input bg-background h-9 rounded-md border px-2 text-xs"
        disabled={isPending}
        onChange={(e) => handle(e.target.value)}
        value={status}
      >
        {OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {QUOTE_STATUS_LABEL[opt]}
          </option>
        ))}
      </select>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
