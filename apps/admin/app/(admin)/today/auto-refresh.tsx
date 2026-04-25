'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

export interface AutoRefreshProps {
  /** 새로고침 주기 (ms). 기본 30초. */
  intervalMs?: number;
}

/**
 * 30초 주기로 router.refresh() 호출하여 Server Component 데이터 자동 갱신.
 * Supabase Realtime 구독 (R8) 대신 단순 polling.
 *
 * 와이어프레임 B02 §자동 새로고침 30초 충족.
 */
export function AutoRefresh(props: AutoRefreshProps): ReactElement {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalMs = props.intervalMs ?? 30_000;

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <span className="bg-success size-2 animate-pulse rounded-full" />
      자동 새로고침 {Math.round(intervalMs / 1000)}초 · 최근{' '}
      {lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </span>
  );
}
