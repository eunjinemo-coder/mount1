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
    <Card className={cn(TONE_CLASS[tone])}>
      <CardContent className="space-y-1 py-5">
        <p className="text-muted-foreground text-sm">{props.label}</p>
        <p className="text-3xl font-bold tabular-nums">{props.value}</p>
        {props.hint ? <p className="text-muted-foreground text-xs">{props.hint}</p> : null}
      </CardContent>
    </Card>
  );
}
