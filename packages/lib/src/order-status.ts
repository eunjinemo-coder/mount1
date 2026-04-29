/**
 * Order status 그룹 상수 — 헌법 제1조 Spec-First.
 *
 * 18개 status 의 source of truth: `packages/types/src/order.ts` `OrderStatusSchema`.
 * ERD §3.4 + `supabase/migrations/0001_init.sql:131` 와 일치.
 *
 * 페이지·route 마다 동일 status 그룹을 하드코딩하면 ERD 변경 시 drift 발생 — 한 곳에서 export 하여 동기화.
 *
 * 사용 예:
 *   import { COMPLETED_ORDER_STATUSES } from '@mount/lib';
 *   .in('status', COMPLETED_ORDER_STATUSES)
 *
 * 단일 페이지에서만 쓰는 의미 한정 그룹 (예: 사진 업로드 가능 = on_site/in_progress) 은
 * page-local `as const` 로 두어 의도 명시 — 본 파일에는 cross-file 사용 그룹만 둔다.
 */

import type { OrderStatus } from '@mount/types';

/**
 * 정산 / 시공 완료 집계 대상 — payout, csv export, technicians 통계 동기화.
 *
 * 사용처: payout/page.tsx · today/page.tsx (driver) · technicians/[id]/page.tsx · payouts/csv/route.ts
 */
export const COMPLETED_ORDER_STATUSES = [
  'no_drill_completed',
  'drill_converted_completed',
  'paid',
  'closed',
] as const satisfies readonly OrderStatus[];

/**
 * 시공 진행 중 — 기사가 현장에서 작업 중인 상태.
 *
 * 사용처: today/page.tsx (driver/admin) · admin/live/page.tsx 의 진행 중 카운트
 */
export const IN_PROGRESS_ORDER_STATUSES = [
  'en_route',
  'on_site',
  'in_progress',
] as const satisfies readonly OrderStatus[];

/**
 * 실시간 현황판 표시 대상 — 배차된 시점부터 시공 중까지.
 *
 * 사용처: admin/live/page.tsx (지도 마커 + 사이드 리스트)
 */
export const LIVE_DASHBOARD_STATUSES = [
  'assigned',
  ...IN_PROGRESS_ORDER_STATUSES,
] as const satisfies readonly OrderStatus[];

/**
 * 배차 누락/지연 알림 대상 — 배차됐지만 진행 시작 안 한 상태.
 *
 * 사용처: today/alerts-panel.tsx 이상 징후 패널
 */
export const DISPATCH_PENDING_STATUSES = [
  'happy_call_done',
  'scheduled',
  'assigned',
] as const satisfies readonly OrderStatus[];
