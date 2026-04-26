'use client';

import { getBrowserClient } from '@mount/db/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';

export interface AutoRefreshProps {
  /** Realtime 신호 끊김 시 fallback polling 주기 (ms). 기본 60초. */
  fallbackIntervalMs?: number;
}

/**
 * Supabase Realtime 구독 — orders / installations / issues 변경 시 즉시 router.refresh().
 * Realtime 연결 실패·끊김 fallback: setInterval 60초 polling.
 *
 * 와이어프레임 B02 §자동 새로고침 충족 (실시간 우선).
 */
export function AutoRefresh(props: AutoRefreshProps): ReactElement {
  const router = useRouter();
  const fallbackIntervalMs = props.fallbackIntervalMs ?? 60_000;
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [status, setStatus] = useState<'connecting' | 'live' | 'polling' | 'error'>('connecting');
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const client = getBrowserClient();

    const triggerRefresh = (): void => {
      router.refresh();
      setLastRefresh(new Date());
    };

    const startFallback = (): void => {
      if (fallbackTimerRef.current) return;
      fallbackTimerRef.current = setInterval(triggerRefresh, fallbackIntervalMs);
      setStatus('polling');
    };

    const stopFallback = (): void => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const channel = client
      .channel('admin-today-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installations' }, triggerRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, triggerRefresh)
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          stopFallback();
          setStatus('live');
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          startFallback();
          setStatus('error');
        }
      });

    return () => {
      stopFallback();
      void client.removeChannel(channel);
    };
  }, [router, fallbackIntervalMs]);

  const indicatorColor =
    status === 'live' ? 'bg-success' : status === 'polling' ? 'bg-warning' : 'bg-muted-foreground';
  const label =
    status === 'live'
      ? '실시간 연결'
      : status === 'polling'
        ? `폴링 ${Math.round(fallbackIntervalMs / 1000)}초`
        : status === 'connecting'
          ? '연결 중'
          : '재연결 중';

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <span className={`size-2 animate-pulse rounded-full ${indicatorColor}`} />
      {label} · 최근{' '}
      {lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </span>
  );
}
