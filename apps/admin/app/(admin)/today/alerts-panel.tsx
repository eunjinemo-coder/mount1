import { getServerClient } from '@mount/db';
import { DISPATCH_PENDING_STATUSES } from '@mount/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { AlertTriangle, Bell, CreditCard, Phone, Send } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * 이상 징후 알림 패널 — 와이어 B02 §4.
 *
 * 4종 룰 (간소 버전 — cron 없이 매 page load 시 query):
 *   1. precall_missing — 시공 30분 전 인데 call_log 없음 (red)
 *   2. payment_delayed — awaiting_payment 24시간 초과 (orange)
 *   3. cancel_untransferred — cancel_requested + transfer_status='pending' 12h 초과 (yellow)
 *   4. issue_unattended — issues 보고된지 2시간 초과 + auto_triggered_action 없음 (yellow)
 *
 * 각 카드는 카운트 + 처리 페이지 진입 링크. 0건이면 카드 미노출.
 */

interface AlertItem {
  id: string;
  level: 'red' | 'orange' | 'yellow';
  icon: typeof Bell;
  title: string;
  count: number;
  description: string;
  actionLabel: string;
  actionHref: string;
}

const LEVEL_CLASS: Record<AlertItem['level'], string> = {
  red: 'border-destructive/40 bg-destructive/5',
  orange: 'border-warning/50 bg-warning/5',
  yellow: 'border-warning/30 bg-warning/5',
};

const LEVEL_ICON_CLASS: Record<AlertItem['level'], string> = {
  red: 'text-destructive',
  orange: 'text-warning',
  yellow: 'text-warning/80',
};

export async function AlertsPanel(): Promise<ReactElement | null> {
  const client = await getServerClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const next30min = new Date(now.getTime() + 30 * 60_000).toISOString();
  const past2h = new Date(now.getTime() - 2 * 60 * 60_000).toISOString();
  const past12h = new Date(now.getTime() - 12 * 60 * 60_000).toISOString();
  const past24h = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  // 1. 시공 30분 전 통화 미기록 — 지금부터 30분 이내 시공 예정인데 사전 통화 안 됐을 때 알림.
  //    scheduled_installation_at 이 [now, now+30min] 구간에 들어오는 주문.
  const { count: precallMissing } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', DISPATCH_PENDING_STATUSES)
    .gte('scheduled_installation_at', nowIso)
    .lte('scheduled_installation_at', next30min);

  // 2. 결제 대기 24h 초과
  const { count: paymentDelayed } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['awaiting_payment', 'payment_sent'])
    .lt('status_changed_at', past24h);

  // 3. 미전달 취소 12h 초과
  const { count: cancelUntransferred } = await client
    .from('cancellation_reports')
    .select('id', { count: 'exact', head: true })
    .eq('coupang_transfer_status', 'pending')
    .lt('created_at', past12h);

  // 4. 이슈 미처리 2h 초과 — auto_triggered_action 없음
  const { count: issueUnattended } = await client
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .is('auto_triggered_action', null)
    .lt('reported_at', past2h);

  const alerts: AlertItem[] = [];

  if ((precallMissing ?? 0) > 0) {
    alerts.push({
      id: 'precall',
      level: 'red',
      icon: Phone,
      title: '시공 30분 전 통화 미기록',
      count: precallMissing ?? 0,
      description: '기사에게 사전 통화 진행 여부를 확인해 주세요.',
      actionLabel: '주문 확인',
      actionHref: '/orders?filter=scheduled',
    });
  }

  if ((paymentDelayed ?? 0) > 0) {
    alerts.push({
      id: 'payment',
      level: 'orange',
      icon: CreditCard,
      title: '결제 대기 24시간 초과',
      count: paymentDelayed ?? 0,
      description: '고객 결제가 지연됐습니다. 카카오톡 채널로 안내 필요.',
      actionLabel: '결제 화면',
      actionHref: '/orders?filter=payment',
    });
  }

  if ((cancelUntransferred ?? 0) > 0) {
    alerts.push({
      id: 'cancel',
      level: 'yellow',
      icon: Send,
      title: '미전달 취소 보고 12시간 초과',
      count: cancelUntransferred ?? 0,
      description: '쿠팡 측에 일괄 전달이 필요한 보고가 누적됐습니다.',
      actionLabel: '쿠팡 정산',
      actionHref: '/coupang',
    });
  }

  if ((issueUnattended ?? 0) > 0) {
    alerts.push({
      id: 'issue',
      level: 'yellow',
      icon: AlertTriangle,
      title: '이슈 미처리 2시간 초과',
      count: issueUnattended ?? 0,
      description: '현장에서 보고된 이슈에 대응이 필요합니다.',
      actionLabel: '주문 확인',
      actionHref: '/orders?filter=progress',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="text-warning size-4" aria-hidden />
          이상 징후 알림
          <span className="text-muted-foreground text-xs font-normal">
            ({alerts.length}건)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 md:grid-cols-2">
          {alerts.map((a) => {
            const Icon = a.icon;
            return (
              <li key={a.id}>
                <Link
                  className={`hover:bg-muted/30 flex items-start gap-3 rounded-md border p-3 transition-colors ${
                    LEVEL_CLASS[a.level]
                  }`}
                  href={a.actionHref}
                >
                  <Icon className={`size-5 shrink-0 mt-0.5 ${LEVEL_ICON_CLASS[a.level]}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      <span className="text-foreground tabular-nums text-lg font-bold leading-none">
                        {a.count}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {a.description}
                    </p>
                    <p className="text-primary mt-1.5 text-xs font-medium">
                      {a.actionLabel} →
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
