'use client';

import type { ReactElement, ReactNode } from 'react';

/**
 * 스토어 폼 공용 필드 래퍼 + 입력 클래스.
 * quote-form / order-form / lookup-form 이 공유 (중복 제거).
 */
export function inputCls(error?: string): string {
  return [
    'w-full rounded-lg border bg-background px-3.5 py-3 text-[15px] outline-none transition-colors',
    'placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring focus:ring-offset-0',
    error ? 'border-destructive' : 'border-input',
  ].join(' ');
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  count?: number;
  max?: number;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  count,
  max,
  error,
  hint,
  children,
}: FieldProps): ReactElement {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {typeof count === 'number' && typeof max === 'number' && (
          <span className="text-muted-foreground tabular text-xs">
            {count.toLocaleString('ko-KR')}/{max.toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-xs leading-5" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs leading-5">{hint}</p>
      ) : null}
    </div>
  );
}
