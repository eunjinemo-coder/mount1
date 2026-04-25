import { Calendar, Home, Settings, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

/**
 * 기사앱 공용 셸 — 상단 헤더(sticky) + 하단 탭바(sticky).
 * 와이어프레임: A02 driver_today §상단 헤더·하단 탭
 *
 * 사용: 인증된 메인 화면(today, order, calendar, payout, profile) 의 page.tsx 에서
 * `<DriverShell title="...">{...}</DriverShell>` 로 감쌈. login·offline 은 미사용.
 */
export interface DriverShellProps {
  title?: string;
  technicianName?: string;
  notificationCount?: number;
  /** 하단 탭바 활성 항목 — 색상 강조 */
  activeTab?: 'home' | 'calendar' | 'payout' | 'settings';
  /** 헤더 좌측 뒤로가기 (지정 시) */
  back?: { href: string; label?: string };
  children: ReactNode;
}

const TABS = [
  { id: 'home', label: '홈', href: '/today', icon: Home },
  { id: 'calendar', label: '예약', href: '/calendar', icon: Calendar },
  { id: 'payout', label: '정산', href: '/payout', icon: Wallet },
  { id: 'settings', label: '설정', href: '/settings', icon: Settings },
] as const;

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

      <nav className="bg-background safe-bottom sticky bottom-0 z-40 border-t">
        <div className="mx-auto grid h-16 w-full max-w-screen-md grid-cols-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = props.activeTab === tab.id;
            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
                href={tab.href}
                key={tab.id}
              >
                <Icon className="size-5" aria-hidden />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
