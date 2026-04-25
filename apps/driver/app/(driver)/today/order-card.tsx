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

export function OrderCard(props: OrderCardData): ReactElement {
  const time = props.scheduled_installation_at
    ? TIME_FORMATTER.format(new Date(props.scheduled_installation_at))
    : '시간 미정';
  const statusLabel = STATUS_LABEL[props.status] ?? props.status;
  const photoTotal = 6;

  return (
    <Link
      className="focus-visible:ring-ring rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      href={`/order/${props.order_id}`}
    >
      <Card className="hover:bg-muted/40 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums">{time}</span>
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
