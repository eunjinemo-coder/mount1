'use client';

import { Calendar, Home, Settings, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

type TabId = 'home' | 'calendar' | 'payout' | 'settings';

const TABS = [
  { id: 'home' as TabId, label: '홈', href: '/today', icon: Home, match: ['/today', '/order'] },
  { id: 'calendar' as TabId, label: '예약', href: '/calendar', icon: Calendar, match: ['/calendar'] },
  { id: 'payout' as TabId, label: '정산', href: '/payout', icon: Wallet, match: ['/payout'] },
  { id: 'settings' as TabId, label: '설정', href: '/settings', icon: Settings, match: ['/settings', '/profile'] },
] as const;

function resolveActive(pathname: string): TabId {
  for (const tab of TABS) {
    if (tab.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return tab.id;
    }
  }
  return 'home';
}

export function BottomNav(): ReactElement {
  const pathname = usePathname();
  const active = resolveActive(pathname);

  return (
    <nav className="bg-background safe-bottom sticky bottom-0 z-40 border-t">
      <div className="mx-auto grid h-16 w-full max-w-screen-md grid-cols-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
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
  );
}
