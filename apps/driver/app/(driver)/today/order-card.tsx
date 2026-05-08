'use client';

import { Badge, Card, CardContent, CardHeader } from '@mount/ui';
import { ChevronRight, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

export interface OrderCardData {
  order_id: string;
  scheduled_installation_at: string | null;
  status: string;
  phone_tail4: string;
  region: string;
  tv: string;
  pre_call_done: boolean;
  photo_count: number;
  status_changed_at?: string | null;
}

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const STATUS_LABEL: Record<string, string> = {
  assigned: '배차 확정',
  en_route: '이동 중',
  on_site: '현장 도착',
  in_progress: '시공 중',
  no_drill_completed: '무타공 완료',
  drill_converted_completed: '타공 전환 완료',
};

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === 'on_site' || status === 'in_progress') return 'default';
  if (status === 'no_drill_completed' || status === 'drill_converted_completed') return 'outline';
  return 'secondary';
}

/** Change 2: left stripe + optional bg tone keyed by status */
function getStatusStripeClass(status: string): string {
  if (status === 'on_site' || status === 'in_progress') {
    return 'border-l-4 border-l-amber-500 bg-amber-50/30';
  }
  if (status === 'no_drill_completed' || status === 'drill_converted_completed') {
    return 'border-l-4 border-l-emerald-500';
  }
  if (status === 'assigned' || status === 'en_route') {
    return 'border-l-4 border-l-slate-300';
  }
  return 'border-l-4 border-l-slate-200';
}

/** Change 3: relative time context label */
function formatRelativeTimeContext(
  scheduled: Date | string,
  status: string,
  statusChangedAt?: string | null,
): string {
  const now = new Date();
  const scheduledDate = scheduled instanceof Date ? scheduled : new Date(scheduled);
  if (isNaN(scheduledDate.getTime())) return '';
  const diffMs = scheduledDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  const isCompleted =
    status === 'no_drill_completed' || status === 'drill_converted_completed';
  const isInProgress = status === 'in_progress' || status === 'on_site';

  if (isCompleted) {
    const referenceDate = statusChangedAt ? new Date(statusChangedAt) : scheduledDate;
    const completedDiffMs = now.getTime() - referenceDate.getTime();
    const completedMins = Math.floor(completedDiffMs / 60_000);
    const completedHours = Math.floor(completedMins / 60);
    if (completedHours >= 1) {
      return `(${completedHours}시간 전 완료)`;
    }
    return `(${completedMins}분 전 완료)`;
  }

  if (isInProgress) {
    const elapsedMs = now.getTime() - scheduledDate.getTime();
    const elapsedMins = Math.floor(elapsedMs / 60_000);
    const elapsedHours = Math.floor(elapsedMins / 60);
    const remainingMins = elapsedMins % 60;
    if (elapsedHours >= 1) {
      return remainingMins > 0
        ? `(${elapsedHours}시간 ${remainingMins}분째 진행)`
        : `(${elapsedHours}시간째 진행)`;
    }
    return `(${elapsedMins}분째 진행)`;
  }

  // Future scheduled
  if (diffMinutes > 0) {
    const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
    if (diffMinutes < 60) {
      return `(${rtf.format(diffMinutes, 'minute')})`;
    }
    const diffHours = Math.round(diffMinutes / 60);
    return `(${rtf.format(diffHours, 'hour')})`;
  }

  // Overdue: past scheduled but not completed
  const overdueMinutes = Math.abs(diffMinutes);
  if (overdueMinutes < 60) {
    return `(${overdueMinutes}분 지연)`;
  }
  const overdueHours = Math.floor(overdueMinutes / 60);
  return `(${overdueHours}시간 지연)`;
}

export function OrderCard(props: OrderCardData): ReactElement {
  const time = props.scheduled_installation_at
    ? TIME_FORMATTER.format(new Date(props.scheduled_installation_at))
    : '시간 미정';
  const statusLabel = STATUS_LABEL[props.status] ?? props.status;
  const photoTotal = 6;

  const relativeTimeCtx = props.scheduled_installation_at
    ? formatRelativeTimeContext(
        props.scheduled_installation_at,
        props.status,
        props.status_changed_at,
      )
    : null;

  const stripeClass = getStatusStripeClass(props.status);

  return (
    <Link
      className="focus-visible:ring-ring rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      href={`/order/${props.order_id}`}
    >
      <Card className={`hover:bg-muted/40 transition-colors ${stripeClass}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold tabular-nums">{time}</span>
            {relativeTimeCtx ? (
              <span className="text-xs text-muted-foreground">{relativeTimeCtx}</span>
            ) : null}
            <Badge variant={statusBadgeVariant(props.status)}>{statusLabel}</Badge>
            {!props.pre_call_done ? (
              <Badge variant="destructive" className="gap-1">
                <PhoneCall className="size-3" />
                통화 필요
              </Badge>
            ) : null}
          </div>
          <ChevronRight className="text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-1 py-3 text-sm">
          <p className="text-base">
            <span className="text-muted-foreground">📍 </span>
            {props.region || '주소 정보 없음'}
          </p>
          <p>
            <span className="text-muted-foreground">📺 </span>
            {props.tv || 'TV 정보 없음'}
          </p>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>고객: ***-****-{props.phone_tail4}</span>
            <span>
              사진 {props.photo_count}/{photoTotal}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
