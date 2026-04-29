import { getServerClient } from '@mount/db';
import { COMPLETED_ORDER_STATUSES, getSession } from '@mount/lib';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['super_admin', 'cs_admin', 'ops_admin']);

interface PayoutRow {
  technician_id: string;
  display_name: string;
  login_id: string;
  grade: string;
  total_completed: number;
  option_a: number;
  option_b: number;
  option_c: number;
  conversions: number;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseDateParam(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getSession();
  if (!session?.adminRole || !ALLOWED_ROLES.has(session.adminRole)) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const from = parseDateParam(url.searchParams.get('from'), startOfWeek);
  const to = parseDateParam(url.searchParams.get('to'), now);

  const client = await getServerClient();
  const { data: completedOrders, error } = await client
    .from('orders')
    .select(
      'id, option_selected, conversion_from_no_drill, assigned_technician_id, status, status_changed_at, technicians:assigned_technician_id(id, display_name, login_id, grade)',
    )
    .in('status', COMPLETED_ORDER_STATUSES)
    .gte('status_changed_at', from.toISOString())
    .lte('status_changed_at', to.toISOString())
    .not('assigned_technician_id', 'is', null);

  if (error) {
    return new Response(`DB error: ${error.message}`, { status: 500 });
  }

  // 기사별 집계 — Map 객체 새로 교체 (헌법 immutability).
  const aggMap = new Map<string, PayoutRow>();
  for (const order of completedOrders ?? []) {
    const techId = order.assigned_technician_id;
    if (!techId) continue;
    const tech = (order as unknown as { technicians?: { display_name?: string; login_id?: string; grade?: string } }).technicians;

    const prev: PayoutRow = aggMap.get(techId) ?? {
      technician_id: techId,
      display_name: tech?.display_name ?? '-',
      login_id: tech?.login_id ?? '-',
      grade: tech?.grade ?? '-',
      total_completed: 0,
      option_a: 0,
      option_b: 0,
      option_c: 0,
      conversions: 0,
    };
    const next: PayoutRow = {
      ...prev,
      total_completed: prev.total_completed + 1,
      option_a: prev.option_a + (order.option_selected === 'A_stand' ? 1 : 0),
      option_b: prev.option_b + (order.option_selected === 'B_drill' ? 1 : 0),
      option_c: prev.option_c + (order.option_selected === 'C_no_drill' ? 1 : 0),
      conversions: prev.conversions + (order.conversion_from_no_drill ? 1 : 0),
    };
    aggMap.set(techId, next);
  }

  const rows = Array.from(aggMap.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name, 'ko'),
  );

  // CSV 생성 — UTF-8 BOM + 한글 헤더 (Excel 호환)
  const header = [
    '기사명',
    '로그인ID',
    '등급',
    '총 완료',
    '옵션A(스탠드)',
    '옵션B(타공)',
    '옵션C(무타공)',
    '전환건',
  ].join(',');

  const lines = rows.map((r) =>
    [
      csvEscape(r.display_name),
      csvEscape(r.login_id),
      csvEscape(r.grade),
      r.total_completed,
      r.option_a,
      r.option_b,
      r.option_c,
      r.conversions,
    ].join(','),
  );

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const summary = `# 정산 집계 ${fromStr} ~ ${toStr} · ${rows.length}명 · ${
    rows.reduce((sum, r) => sum + r.total_completed, 0)
  }건`;

  // UTF-8 BOM (U+FEFF) — Excel 에서 한글 깨짐 방지
  const csv = '﻿' + `${summary}\n${header}\n${lines.join('\n')}\n`;
  const filename = `payout_${fromStr}_${toStr}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
