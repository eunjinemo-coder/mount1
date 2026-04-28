import { Card, CardContent } from '@mount/ui';
import { cn } from '@mount/ui';
import type { ReactElement } from 'react';

export interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}

const TONE_CLASS: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: '',
  success: 'border-l-4 border-l-success',
  warning: 'border-l-4 border-l-warning',
  destructive: 'border-l-4 border-l-destructive',
};

export function KpiCard(props: KpiCardProps): ReactElement {
  const tone = props.tone ?? 'default';
  return (
    <Card className={cn('transition-shadow duration-200 hover:shadow-md', TONE_CLASS[tone])}>
      <CardContent className="flex flex-col gap-1.5 px-5 py-5">
        <p className="text-muted-foreground text-sm font-medium leading-none">{props.label}</p>
        <p className="text-foreground text-4xl font-bold tabular-nums tracking-tight leading-none">
          {props.value}
        </p>
        {props.hint ? (
          <p className="text-muted-foreground mt-0.5 text-xs leading-tight">{props.hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
