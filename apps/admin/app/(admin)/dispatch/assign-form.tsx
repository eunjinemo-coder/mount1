'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@mount/ui';
import { cn } from '@mount/ui';
import { UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import { assignOrderAction } from './actions';

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
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const GRADE_LABEL: Record<string, string> = {
  gold: '골드',
  silver: '실버',
  bronze: '브론즈',
};

export function AssignForm(props: AssignFormProps): ReactElement {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = !!selectedOrderId && !!selectedTechId && !isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">미배차 주문 ({props.orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {props.orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">미배차 주문이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {props.orders.map((order) => {
                  const time = order.scheduled_at
                    ? TIME_FORMATTER.format(new Date(order.scheduled_at))
                    : '시간 미정';
                  const isSelected = selectedOrderId === order.id;
                  return (
                    <li key={order.id}>
                      <button
                        className={cn(
                          'hover:bg-muted/40 w-full rounded-md border px-3 py-2 text-left transition-colors',
                          isSelected ? 'border-primary bg-primary/5' : 'border-border',
                        )}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setError(null);
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{time}</span>
                          <span className="text-muted-foreground text-xs">{order.region}</span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">{order.tv}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">활성 기사 ({props.technicians.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {props.technicians.length === 0 ? (
              <p className="text-muted-foreground text-sm">활성 기사가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {props.technicians.map((tech) => {
                  const isSelected = selectedTechId === tech.id;
                  return (
                    <li key={tech.id}>
                      <button
                        className={cn(
                          'hover:bg-muted/40 flex w-full items-center justify-between rounded-md border px-3 py-2 transition-colors',
                          isSelected ? 'border-primary bg-primary/5' : 'border-border',
                        )}
                        onClick={() => {
                          setSelectedTechId(tech.id);
                          setError(null);
                        }}
                        type="button"
                      >
                        <span className="text-sm font-medium">{tech.display_name}</span>
                        <Badge variant="outline">{GRADE_LABEL[tech.grade] ?? tech.grade}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}

      <div className="bg-background sticky bottom-0 -mx-6 border-t px-6 py-4">
        <Button
          className="w-full md:w-auto"
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
          <UserCheck className="size-4" />
          {isPending ? '배차 확정 중…' : '배차 확정'}
        </Button>
      </div>
    </div>
  );
}
