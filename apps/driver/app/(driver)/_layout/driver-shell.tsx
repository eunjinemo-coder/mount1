import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { BottomNav } from './bottom-nav';

/**
 * 기사앱 공용 셸 — 상단 헤더(sticky) + 하단 탭바(sticky).
 * 와이어프레임: A02 driver_today §상단 헤더·하단 탭
 *
 * 사용: 인증된 메인 화면(today, order, calendar, payout, profile) 의 page.tsx 에서
 * `<DriverShell title="...">{...}</DriverShell>` 로 감쌈. login·offline 은 미사용.
 *
 * activeTab 은 BottomNav 가 usePathname() 으로 자동 결정 — 호출부에서 전달 불필요.
 */
export interface DriverShellProps {
  title?: string;
  technicianName?: string;
  notificationCount?: number;
  /** 헤더 좌측 뒤로가기 (지정 시) */
  back?: { href: string; label?: string };
  children: ReactNode;
}

export function DriverShell(props: DriverShellProps): ReactElement {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background safe-top sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 w-full max-w-screen-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {props.back ? (
              <Link
                className="text-muted-foreground hover:text-foreground text-sm"
                href={props.back.href}
              >
                ← {props.back.label ?? '뒤로'}
              </Link>
            ) : null}
            <span className="font-semibold">
              {props.technicianName ? `${props.technicianName}님` : '마운트파트너스'}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            {typeof props.notificationCount === 'number' && props.notificationCount > 0 ? (
              <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs">
                🔔 {props.notificationCount}
              </span>
            ) : null}
            <Link aria-label="프로필" className="hover:text-foreground" href="/profile">
              👤
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{props.children}</main>

      <BottomNav />
    </div>
  );
}
