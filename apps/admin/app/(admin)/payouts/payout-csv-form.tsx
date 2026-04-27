'use client';

import { Button, Input } from '@mount/ui';
import { Download } from 'lucide-react';
import { useState, type ReactElement } from 'react';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFor(preset: 'this_week' | 'last_week' | 'this_month' | 'last_month'): {
  from: string;
  to: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'this_week') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: formatDate(monday), to: formatDate(today) };
  }
  if (preset === 'last_week') {
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return { from: formatDate(lastMonday), to: formatDate(lastSunday) };
  }
  if (preset === 'this_month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDate(first), to: formatDate(today) };
  }
  // last_month
  const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastLast = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: formatDate(firstLast), to: formatDate(lastLast) };
}

export function PayoutCsvForm(): ReactElement {
  const initial = rangeFor('this_week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const setPreset = (p: 'this_week' | 'last_week' | 'this_month' | 'last_month'): void => {
    const r = rangeFor(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const downloadUrl = `/api/payouts/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}T23:59:59`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPreset('this_week')} size="sm" type="button" variant="outline">
          이번 주
        </Button>
        <Button onClick={() => setPreset('last_week')} size="sm" type="button" variant="outline">
          지난 주
        </Button>
        <Button onClick={() => setPreset('this_month')} size="sm" type="button" variant="outline">
          이번 달
        </Button>
        <Button onClick={() => setPreset('last_month')} size="sm" type="button" variant="outline">
          지난 달
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">시작일</span>
          <Input
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            value={from}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">종료일</span>
          <Input
            onChange={(e) => setTo(e.target.value)}
            type="date"
            value={to}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild>
          <a download href={downloadUrl} rel="noreferrer">
            <Download className="mr-2 size-4" />
            CSV 다운로드
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">
          기사별 시공 완료 건수 + 옵션 분포 (A 스탠드 / B 타공 / C 무타공) + 전환 건수.
          UTF-8 BOM 포함 — Excel 에서 한글 깨짐 없이 열림.
        </p>
      </div>
    </div>
  );
}
