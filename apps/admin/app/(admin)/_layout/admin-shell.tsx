import { getSession } from '@mount/lib';
import {
  AlertCircle,
  ClipboardList,
  Coffee,
  Cog,
  CreditCard,
  Hammer,
  Home,
  MapPin,
  Package,
  ShoppingCart,
  Store,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { UserMenu } from './user-menu';

const ROLE_LABEL: Record<string, string> = {
  super_admin: '대표',
  cs_admin: '본사CS',
  dispatch_admin: '배차담당',
  ops_admin: '쿠팡CS',
  auditor: '감사',
};

/**
 * 관리자 공용 셸 — 좌측 사이드바 + 상단 헤더.
 * 와이어프레임: B02 admin_today §글로벌 헤더·사이드바
 *
 * 디자인 시스템:
 * - 사이드바: w-52 (한글 라벨 여유)
 * - active: bg-primary/10 + 좌측 indicator bar
 * - hover: bg-muted/60 (대비 ↑)
 */
export interface AdminShellProps {
  title?: string;
  adminName?: string;
  adminRole?: string;
  notificationCount?: number;
  activeNav?:
    | 'today'
    | 'orders'
    | 'dispatch'
    | 'technicians'
    | 'installations'
    | 'live'
    | 'payouts'
    | 'coupang'
    | 'storeProducts'
    | 'storeOrders'
    | 'storeQuotes'
    | 'settings';
  children: ReactNode;
}

const NAV = [
  { id: 'today', label: '오늘', href: '/today', icon: Home },
  { id: 'orders', label: '주문', href: '/orders', icon: Package },
  { id: 'installations', label: '시공', href: '/installations', icon: Hammer },
  { id: 'technicians', label: '기사', href: '/technicians', icon: Wrench },
  { id: 'dispatch', label: '배차', href: '/dispatch', icon: Users },
  { id: 'live', label: '실시간', href: '/live', icon: MapPin },
  { id: 'payouts', label: '정산', href: '/payouts', icon: CreditCard },
  { id: 'coupang', label: '쿠팡', href: '/coupang', icon: Coffee },
] as const;

// P0 스토어(무타공 브라켓) 운영 메뉴 — 02_PRD_P0_STORE.md §1 어드민 표.
const STORE_NAV = [
  { id: 'storeProducts', label: '상품', href: '/store/products', icon: Store },
  { id: 'storeOrders', label: '스토어 주문', href: '/store/orders', icon: ShoppingCart },
  { id: 'storeQuotes', label: '견적요청', href: '/store/quotes', icon: ClipboardList },
] as const;

const SETTINGS_NAV = { id: 'settings', label: '설정', href: '/settings', icon: Cog } as const;

export async function AdminShell(props: AdminShellProps): Promise<ReactElement> {
  // 세션 자동 fetch — props 우선, 없으면 session 에서 보충
  const session = props.adminName && props.adminRole ? null : await getSession();
  const resolvedName = props.adminName ?? session?.userId.slice(0, 6) ?? '관리자';
  const resolvedRole = props.adminRole ?? session?.adminRole ?? '';

  return (
    <div className="bg-background flex min-h-dvh">
      <aside className="bg-card sticky top-0 hidden h-dvh w-52 shrink-0 border-r md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="text-lg" aria-hidden>
            🛠
          </span>
          <span className="font-bold tracking-tight">마운트파트너스</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink isActive={props.activeNav === item.id} item={item} key={item.id} />
          ))}
          <p className="text-muted-foreground/70 px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase">
            스토어
          </p>
          {STORE_NAV.map((item) => (
            <NavLink isActive={props.activeNav === item.id} item={item} key={item.id} />
          ))}
          <div className="pt-1">
            <NavLink isActive={props.activeNav === SETTINGS_NAV.id} item={SETTINGS_NAV} />
          </div>
        </nav>
        <div className="border-t px-4 py-3">
          <p className="text-muted-foreground text-xs">마운트파트너스 v0.1.0</p>
          <p className="text-muted-foreground/70 text-[11px]">© 2026 벽걸이프로</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-16 items-center justify-between border-b px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-semibold md:hidden">🛠 마운트파트너스</span>
            {props.title ? (
              <h1 className="text-foreground text-base font-semibold tracking-tight">
                {props.title}
              </h1>
            ) : null}
          </div>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            {typeof props.notificationCount === 'number' && props.notificationCount > 0 ? (
              <span className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                <AlertCircle className="size-3" aria-hidden />
                <span>{props.notificationCount}</span>
              </span>
            ) : null}
            <UserMenu
              adminName={resolvedName}
              adminRoleLabel={ROLE_LABEL[resolvedRole] ?? '관리자'}
            />
          </div>
        </header>

        <main className="flex-1">{props.children}</main>
      </div>
    </div>
  );
}

interface NavItemData {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

function NavLink({ item, isActive }: { item: NavItemData; isActive: boolean }): ReactElement {
  const Icon = item.icon;
  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
      href={item.href}
    >
      {isActive ? (
        <span aria-hidden className="bg-primary absolute inset-y-1 left-0 w-1 rounded-r" />
      ) : null}
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
