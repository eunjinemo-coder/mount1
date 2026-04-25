import {
  AlertCircle,
  Coffee,
  CreditCard,
  Home,
  MapPin,
  Package,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

/**
 * 관리자 공용 셸 — 글로벌 헤더 + 좌측 사이드바.
 * 와이어프레임: B02 admin_today §글로벌 헤더·사이드바
 *
 * 사용: 인증된 admin 화면(today, orders, dispatch, live, payouts 등) 에서
 * `<AdminShell title="...">{...}</AdminShell>` 로 감쌈. login 은 미사용.
 */
export interface AdminShellProps {
  title?: string;
  adminName?: string;
  notificationCount?: number;
  /** 사이드바 활성 항목 */
  activeNav?: 'today' | 'orders' | 'dispatch' | 'technicians' | 'live' | 'payouts' | 'coupang';
  children: ReactNode;
}

const NAV = [
  { id: 'today', label: 'Today', href: '/today', icon: Home },
  { id: 'orders', label: 'Orders', href: '/orders', icon: Package },
  { id: 'technicians', label: 'Techs', href: '/technicians', icon: Wrench },
  { id: 'dispatch', label: 'Dispatch', href: '/dispatch', icon: Users },
  { id: 'live', label: 'Live', href: '/live', icon: MapPin },
  { id: 'payouts', label: 'Pay', href: '/payouts', icon: CreditCard },
  { id: 'coupang', label: 'Cpng', href: '/coupang', icon: Coffee },
] as const;

export function AdminShell(props: AdminShellProps): ReactElement {
  return (
    <div className="bg-background flex min-h-dvh">
      <aside className="bg-card sticky top-0 hidden h-dvh w-44 shrink-0 border-r md:flex md:flex-col">
        <div className="flex h-14 items-center px-4 font-semibold">🛠 MountPartners</div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = props.activeNav === item.id;
            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                href={item.href}
                key={item.id}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="text-muted-foreground p-3 text-xs">v0.1.0 · © 2026</div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="bg-background sticky top-0 z-40 flex h-14 items-center justify-between border-b px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold md:hidden">🛠 MountPartners</span>
            {props.title ? <h1 className="text-foreground text-base">{props.title}</h1> : null}
          </div>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            {typeof props.notificationCount === 'number' && props.notificationCount > 0 ? (
              <span className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                <AlertCircle className="size-3" />
                {props.notificationCount}
              </span>
            ) : null}
            <span>{props.adminName ?? '관리자'} ▾</span>
          </div>
        </header>

        <main className="flex-1">{props.children}</main>
      </div>
    </div>
  );
}
