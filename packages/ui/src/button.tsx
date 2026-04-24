import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  // shadcn/ui New York preset 통합 예정 · 04_DESIGN_SYSTEM/08_TOKEN_EXPORT.md
  return (
    <button
      type={type}
      className={cn(
        'mp-button',
        `mp-button--${variant}`,
        `mp-button--${size}`,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
