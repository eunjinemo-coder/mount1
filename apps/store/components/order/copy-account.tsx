'use client';

import { Check, Copy } from 'lucide-react';
import { useState, type ReactElement } from 'react';

interface Props {
  value: string;
  label: string;
}

/**
 * 계좌번호·주문번호 복사 버튼.
 * 전화 통화 중 손으로 옮겨 적다 생기는 오기입(잘못된 계좌 이체)을 막기 위한 용도.
 */
export function CopyButton({ value, label }: Props): ReactElement {
  const [copied, setCopied] = useState(false);

  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 거부 등 — 값은 이미 화면에 표시되어 있으므로 조용히 무시
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center align-[-6px]"
      >
        {copied ? (
          <Check className="text-success size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
      <span className="text-success text-xs" aria-live="polite">
        {copied ? '복사됨' : ''}
      </span>
    </span>
  );
}
