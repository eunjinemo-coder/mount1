'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { cn } from '@mount/ui';
import { CheckCircle2, MapPin, Package, Sparkles, UserCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import {
  assignOrderAction,
  recommendTechniciansAction,
  type RecommendedTechnician,
} from './actions';

export interface DispatchOrder {
  id: string;
  tv: string;
  region: string;
  scheduled_at: string | null;
}

export interface DispatchTechnician {
  id: string;
  display_name: string;
  grade: string;
}

export interface AssignFormProps {
  orders: DispatchOrder[];
  technicians: DispatchTechnician[];
}

const TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Seoul',
});

const GRADE_LABEL: Record<string, string> = {
  gold: '골드',
  silver: '실버',
  bronze: '브론즈',
};

const GRADE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  gold: 'default',
  silver: 'secondary',
  bronze: 'outline',
};

/** 일자별 그룹핑 — 오늘/내일/이후 prefix */
function groupByDay(orders: DispatchOrder[]): Map<string, DispatchOrder[]> {
  const map = new Map<string, DispatchOrder[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  for (const order of orders) {
    let key: string;
    if (!order.scheduled_at) {
      key = '시간 미정';
    } else {
      const d = new Date(order.scheduled_at);
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (dayKey === today.getTime()) key = `오늘 · ${DATE_FORMATTER.format(d)}`;
      else if (dayKey === tomorrow.getTime()) key = `내일 · ${DATE_FORMATTER.format(d)}`;
      else key = DATE_FORMATTER.format(d);
    }
    const list = map.get(key) ?? [];
    list.push(order);
    map.set(key, list);
  }
  return map;
}

export function AssignForm(props: AssignFormProps): ReactElement {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTechnician[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRecommending, startRecommend] = useTransition();

  const canSubmit = !!selectedOrderId && !!selectedTechId && !isPending;

  // 시간 빠른 순 정렬 + 일자 그룹
  const sortedOrders = useMemo(
    () =>
      [...props.orders].sort((a, b) => {
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      }),
    [props.orders],
  );
  const groupedOrders = useMemo(() => groupByDay(sortedOrders), [sortedOrders]);

  // 선택 정보 — sticky CTA 요약용
  const selectedOrder = sortedOrders.find((o) => o.id === selectedOrderId);
  const selectedTech =
    recommendations.find((r) => r.technician_id === selectedTechId) ??
    props.technicians.find((t) => t.id === selectedTechId);

  const handleSelectOrder = (orderId: string): void => {
    setSelectedOrderId(orderId);
    setSelectedTechId(null);
    setRecommendations([]);
    setError(null);
    startRecommend(async () => {
      const result = await recommendTechniciansAction(orderId);
      if (result.ok && result.recommendations) {
        setRecommendations(result.recommendations);
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* === 미배정 주문 (좌) === */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="text-warning size-4" aria-hidden />
              기사 배정 대기 주문
              <Badge variant="secondary" className="ml-auto">
                {props.orders.length}건
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {props.orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="text-success/60 size-10" aria-hidden />
                <p className="text-muted-foreground text-sm">배정 대기 주문이 없어요.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...groupedOrders.entries()].map(([groupLabel, groupOrders]) => (
                  <div key={groupLabel}>
                    <p className="text-muted-foreground sticky top-0 bg-card/80 backdrop-blur mb-1.5 px-1 pb-1 text-xs font-semibold uppercase tracking-wider">
                      {groupLabel}
                    </p>
                    <ul className="space-y-1.5">
                      {groupOrders.map((order) => {
                        const time = order.scheduled_at
                          ? TIME_FORMATTER.format(new Date(order.scheduled_at))
                          : '미정';
                        const isSelected = selectedOrderId === order.id;
                        return (
                          <li key={order.id}>
                            <button
                              className={cn(
                                'group hover:border-primary/50 hover:bg-muted/30 flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border',
                              )}
                              onClick={() => handleSelectOrder(order.id)}
                              type="button"
                            >
                              <div className="bg-primary/10 text-primary flex size-12 shrink-0 flex-col items-center justify-center rounded-md font-bold tabular-nums">
                                <span className="text-base leading-none">{time}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-sm">
                                  {order.region}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {order.tv}
                                </p>
                              </div>
                              {isSelected ? (
                                <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === 시공 가능 기사 (우) === */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="text-primary size-4" aria-hidden />
              시공 가능 기사
              <Badge variant="secondary" className="ml-auto">
                {props.technicians.length}명
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {props.technicians.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                시공 가능한 기사가 없어요.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {props.technicians.map((tech) => {
                  const isSelected = selectedTechId === tech.id;
                  return (
                    <li key={tech.id}>
                      <button
                        className={cn(
                          'hover:border-primary/50 hover:bg-muted/30 flex w-full items-center justify-between rounded-md border px-3 py-2.5 transition-all',
                          isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border',
                        )}
                        onClick={() => {
                          setSelectedTechId(tech.id);
                          setError(null);
                        }}
                        type="button"
                      >
                        <span className="font-medium text-sm">{tech.display_name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={GRADE_BADGE_VARIANT[tech.grade] ?? 'outline'}>
                            {GRADE_LABEL[tech.grade] ?? tech.grade}
                          </Badge>
                          {isSelected ? (
                            <CheckCircle2 className="text-primary size-4" aria-hidden />
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === 추천 기사 — 주문 선택 시 fetch === */}
      {selectedOrderId ? (
        <Card className="border-primary/40 ring-primary/5 ring-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="text-primary size-4" aria-hidden />
              추천 기사 {isRecommending ? '(분석 중…)' : `· 상위 ${recommendations.length}명`}
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              거리·등급·당일 일감 수·선호 지역·공정성을 합산한 100점 기준 점수예요. 점수가 높을수록 적합합니다.
            </p>
          </CardHeader>
          <CardContent>
            {isRecommending ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-muted/30 h-20 animate-pulse rounded-md" />
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                추천할 수 있는 기사가 없어요 (모두 오늘 일감 가득 또는 휴직 상태).
              </p>
            ) : (
              <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {recommendations.map((rec) => {
                  const isSelected = selectedTechId === rec.technician_id;
                  const distance =
                    rec.distance_km == null ? null : `${rec.distance_km.toFixed(1)}km`;
                  const score = Math.round(rec.score);
                  const scoreColor =
                    score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-muted-foreground';
                  return (
                    <li key={rec.technician_id}>
                      <button
                        className={cn(
                          'hover:border-primary/50 hover:bg-muted/30 group flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-all',
                          isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border',
                        )}
                        onClick={() => {
                          setSelectedTechId(rec.technician_id);
                          setError(null);
                        }}
                        type="button"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-sm">{rec.display_name}</span>
                          <span className="text-foreground text-lg font-bold tabular-nums tracking-tight">
                            {score}
                            <span className="text-muted-foreground ml-0.5 text-xs font-normal">/100</span>
                          </span>
                        </div>
                        {/* 점수 progress bar */}
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className={cn('h-full transition-all duration-300', scoreColor)}
                            style={{ width: `${Math.max(2, score)}%` }}
                          />
                        </div>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                          <Badge variant={GRADE_BADGE_VARIANT[rec.grade] ?? 'outline'} className="text-[10px]">
                            {GRADE_LABEL[rec.grade] ?? rec.grade}
                          </Badge>
                          {distance ? (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="size-3" aria-hidden />
                              {distance}
                            </span>
                          ) : null}
                          <span>오늘 {rec.today_load}건</span>
                          {rec.preferred_match ? (
                            <span className="text-primary font-medium">선호 지역</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Sparkles className="text-muted-foreground/40 size-8" aria-hidden />
            <p className="text-muted-foreground text-sm">
              위에서 주문을 선택하면 추천 기사 5명이 자동으로 분석돼요.
            </p>
          </CardContent>
        </Card>
      )}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2 text-sm">
          <p className="text-destructive">{error}</p>
        </div>
      ) : null}

      {/* === Sticky 하단 CTA — 선택 요약 + 확정 버튼 === */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t px-6 py-3 backdrop-blur lg:left-52">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div className="text-sm">
            {selectedOrder || selectedTech ? (
              <p className="text-foreground">
                {selectedOrder ? (
                  <span>
                    <span className="text-muted-foreground">주문</span>{' '}
                    <strong>
                      {selectedOrder.scheduled_at
                        ? TIME_FORMATTER.format(new Date(selectedOrder.scheduled_at))
                        : '미정'}{' '}
                      · {selectedOrder.region}
                    </strong>
                  </span>
                ) : (
                  <span className="text-muted-foreground">주문 미선택</span>
                )}
                <span className="text-muted-foreground mx-2">→</span>
                {selectedTech ? (
                  <strong className="text-primary">
                    {'display_name' in selectedTech
                      ? selectedTech.display_name
                      : (selectedTech as RecommendedTechnician).display_name}{' '}
                    기사
                  </strong>
                ) : (
                  <span className="text-muted-foreground">기사 미선택</span>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground">
                주문과 기사를 선택해 주세요.
              </p>
            )}
          </div>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!selectedOrderId || !selectedTechId) return;
              setError(null);
              startTransition(async () => {
                const result = await assignOrderAction(selectedOrderId, selectedTechId);
                if (result.ok) {
                  setSelectedOrderId(null);
                  setSelectedTechId(null);
                  router.refresh();
                } else if (result.error) {
                  setError(result.error);
                }
              });
            }}
            size="lg"
          >
            <UserCheck className="size-4" aria-hidden />
            {isPending ? '배차 확정 중…' : '배차 확정'}
          </Button>
        </div>
      </div>
    </div>
  );
}
