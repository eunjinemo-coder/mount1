'use client';

import { Cog, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { signOutAction } from './actions';

export interface UserMenuProps {
  adminName: string;
  adminRoleLabel: string;
}

export function UserMenu(props: UserMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 / Escape 닫힘
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="hover:bg-muted/60 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
          <User className="size-3.5" aria-hidden />
        </span>
        <span className="hidden sm:inline">{props.adminName}</span>
        <span className="text-muted-foreground hidden text-xs sm:inline">▾</span>
      </button>

      {open ? (
        <div
          className="bg-popover text-popover-foreground absolute right-0 top-full z-50 mt-2 min-w-56 overflow-hidden rounded-md border shadow-lg"
          role="menu"
        >
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">{props.adminName}</p>
            <p className="text-muted-foreground text-xs">{props.adminRoleLabel}</p>
          </div>
          <Link
            className="hover:bg-muted/60 flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors"
            href="/settings"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Cog className="text-muted-foreground size-4" aria-hidden />
            설정
          </Link>
          <form action={signOutAction}>
            <button
              className="hover:bg-muted/60 border-t flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors"
              role="menuitem"
              type="submit"
            >
              <LogOut className="text-muted-foreground size-4" aria-hidden />
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
