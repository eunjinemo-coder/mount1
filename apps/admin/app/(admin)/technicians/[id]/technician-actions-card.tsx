'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { AlertCircle, Lock, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import {
  unlockTechnicianAction,
  updateCapacityAction,
  updateGradeAction,
  updateStatusAction,
} from './actions';

export interface TechnicianDetail {
  id: string;
  display_name: string;
  login_id: string;
  phone: string;
  grade: string;
  status: string;
  daily_max_jobs: number;
  weekend_enabled: boolean;
  failed_login_count: number;
  locked_until: string | null;
  vehicle_number: string | null;
  home_base_region: string | null;
  preferred_regions: string[];
  created_at: string;
}

const GRADE_LABEL: Record<string, string> = {
  gold: '골드',
  silver: '실버',
  bronze: '브론즈',
};

const STATUS_LABEL: Record<string, string> = {
  active: '활성',
  paused: '휴직',
  terminated: '계약 종료',
};

export function TechnicianActionsCard(props: { tech: TechnicianDetail }): ReactElement {
  const router = useRouter();
  const t = props.tech;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLocked = t.failed_login_count >= 5 ||
    (t.locked_until !== null && new Date(t.locked_until) > new Date());

  const [grade, setGrade] = useState(t.grade);
  const [status, setStatus] = useState(t.status);
  const [dailyMax, setDailyMax] = useState(t.daily_max_jobs);
  const [weekendOn, setWeekendOn] = useState(t.weekend_enabled);

  const handle = (
    label: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
  ): void => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const r = await action();
        if (r.ok) {
          setSuccess(`${label} 완료`);
          router.refresh();
        } else {
          setError(r.error ?? `${label} 실패`);
        }
      } catch {
        setError('권한이 없거나 서버 오류');
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>잠금 / 로그인 실패</span>
            {isLocked ? (
              <Badge variant="destructive">
                <Lock className="mr-1 size-3" />
                잠김
              </Badge>
            ) : (
              <Badge variant="secondary">정상</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p className="text-muted-foreground">실패 횟수: <strong className="text-foreground">{t.failed_login_count}</strong></p>
            {t.locked_until ? (
              <p className="text-muted-foreground">잠금 만료: {new Date(t.locked_until).toLocaleString('ko-KR')}</p>
            ) : null}
          </div>
          <Button
            disabled={isPending || (!isLocked && t.failed_login_count === 0)}
            onClick={() => handle('잠금 해제', () => unlockTechnicianAction(t.id))}
            size="sm"
            variant={isLocked ? 'default' : 'outline'}
          >
            <Unlock className="mr-2 size-3.5" />
            잠금 해제 + 실패 카운트 reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">등급</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            onChange={(e) => setGrade(e.target.value)}
            value={grade}
          >
            <option value="bronze">브론즈 (신규)</option>
            <option value="silver">실버 (3개월+)</option>
            <option value="gold">골드 (검증 완료)</option>
          </select>
          <Button
            disabled={isPending || grade === t.grade}
            onClick={() =>
              handle('등급 변경', () =>
                updateGradeAction(t.id, grade as 'bronze' | 'silver' | 'gold'),
              )
            }
            size="sm"
          >
            {GRADE_LABEL[t.grade]} → {GRADE_LABEL[grade]} 변경
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            onChange={(e) => setStatus(e.target.value)}
            value={status}
          >
            <option value="active">활성 — 배차·로그인 가능</option>
            <option value="paused">휴직 — 배차 불가, 로그인 가능</option>
            <option value="terminated">계약 종료 — 모두 차단</option>
          </select>
          <Button
            disabled={isPending || status === t.status}
            onClick={() =>
              handle('상태 변경', () =>
                updateStatusAction(t.id, status as 'active' | 'paused' | 'terminated'),
              )
            }
            size="sm"
            variant={status === 'terminated' ? 'destructive' : 'default'}
          >
            {STATUS_LABEL[t.status]} → {STATUS_LABEL[status]} 변경
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">배차 한도</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="space-y-1.5 block">
            <span className="text-sm font-medium">일일 최대</span>
            <Input
              max={20}
              min={1}
              onChange={(e) => setDailyMax(Number(e.target.value))}
              type="number"
              value={dailyMax}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={weekendOn}
              onChange={(e) => setWeekendOn(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm">주말 시공 가능</span>
          </label>
          <Button
            disabled={
              isPending ||
              (dailyMax === t.daily_max_jobs && weekendOn === t.weekend_enabled)
            }
            onClick={() =>
              handle('한도 변경', () => updateCapacityAction(t.id, dailyMax, weekendOn))
            }
            size="sm"
          >
            저장
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-md border px-3 py-2">
          <AlertCircle className="text-destructive size-4 mt-0.5" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}
      {success ? (
        <div className="border-success/30 bg-success/10 rounded-md border px-3 py-2 text-sm">
          {success}
        </div>
      ) : null}
    </div>
  );
}
