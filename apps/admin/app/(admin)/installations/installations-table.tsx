'use client';

/**
 * 시공 목록 테이블(클라이언트) — 다중선택 + 일괄삭제.
 *
 * 선택 UX:
 *   · 행 체크박스 클릭 = 토글 · 헤더 체크박스 = 전체선택/해제
 *   · Shift+클릭 = 직전 클릭행부터 범위선택
 *   · 드래그 스윕 = 체크박스에서 누른 채 위/아래로 끌면 지나간 행이 연속선택
 * 삭제: 확인 후 deleteInstallationJobsAction — 연결 시트의 행도 함께 삭제(빈 행 없음).
 */
import { Badge, Button } from '@mount/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactElement } from 'react';
import { deleteInstallationJobsAction } from './actions';

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

export interface InstallationListRow {
  id: string;
  scheduled_install_date: string | null;
  visit_time: string | null;
  customer_name: string | null;
  address: string | null;
  technician_name: string | null;
  status: string | null;
}

export function InstallationsTable({
  jobs,
  loadFailed = false,
}: {
  jobs: InstallationListRow[];
  /** 조회 자체가 실패했는가(= 데이터 없음과 구분). 장애를 "삭제됨"으로 오인하지 않게. */
  loadFailed?: boolean;
}): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // 드래그 스윕/Shift 범위의 기준 인덱스
  const anchorRef = useRef<number | null>(null);
  const dragRef = useRef<{ active: boolean; mode: 'add' | 'remove' }>({ active: false, mode: 'add' });

  const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  function setRange(from: number, to: number, mode: 'add' | 'remove'): void {
    const [a, b] = from <= to ? [from, to] : [to, from];
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = a; i <= b; i += 1) {
        const id = jobs[i]?.id;
        if (!id) continue;
        if (mode === 'add') next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function onCheckPointerDown(index: number, e: { shiftKey: boolean }): void {
    const id = jobs[index]?.id;
    if (!id) return;
    if (e.shiftKey && anchorRef.current !== null) {
      // Shift+클릭 = 범위선택
      setRange(anchorRef.current, index, 'add');
    } else {
      const mode: 'add' | 'remove' = selected.has(id) ? 'remove' : 'add';
      dragRef.current = { active: true, mode };
      setRange(index, index, mode);
    }
    anchorRef.current = index;
  }

  function onRowPointerEnter(index: number): void {
    if (!dragRef.current.active || anchorRef.current === null) return;
    setRange(anchorRef.current, index, dragRef.current.mode);
  }

  function endDrag(): void {
    dragRef.current.active = false;
  }

  function toggleAll(): void {
    setSelected(allSelected ? new Set() : new Set(jobs.map((j) => j.id)));
  }

  /** 모바일 카드용 단순 토글(드래그/Shift 없음). */
  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDelete(): void {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 시공 ${ids.length}건을 삭제할까요?\n연결된 구글시트의 행도 함께 삭제됩니다(복구 불가).`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteInstallationJobsAction(ids);
      if (!res.ok) {
        setError(res.error ?? '삭제 실패');
        return;
      }
      setSelected(new Set());
      anchorRef.current = null;
      router.refresh();
    });
  }

  return (
    <div className="space-y-3" onPointerUp={endDrag} onPointerLeave={endDrag}>
      {selected.size > 0 ? (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
          <p className="text-sm">
            <span className="font-semibold">{selected.size}건</span> 선택됨
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setSelected(new Set())}>
              선택 해제
            </Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete}>
              {pending ? '삭제 중…' : '선택 삭제'}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {loadFailed ? (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-md border p-4">
          <p className="text-destructive text-sm font-medium">
            시공 목록을 불러오지 못했습니다 (일시적 오류)
          </p>
          <p className="text-muted-foreground text-sm">
            데이터가 삭제된 것이 아닙니다. 잠시 후 새로고침해 주세요. 계속되면 네트워크 상태를
            확인해 주세요.
          </p>
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            다시 시도
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-muted-foreground text-sm">조회된 시공이 없습니다.</p>
      ) : (
        <>
          {/* 모바일: 카드 리스트 — 체크박스로 선택, 카드 탭=상세 */}
          <div className="space-y-2 md:hidden">
            <label className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
              <input
                aria-label="전체 선택"
                checked={allSelected}
                className="size-4"
                onChange={toggleAll}
                type="checkbox"
              />
              전체 선택
            </label>
            {jobs.map((job) => {
              const isSelected = selected.has(job.id);
              return (
                <div
                  className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                    isSelected ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                  key={job.id}
                >
                  <input
                    aria-label={`${job.customer_name ?? '시공'} 선택`}
                    checked={isSelected}
                    className="size-5 shrink-0"
                    onChange={() => toggleOne(job.id)}
                    type="checkbox"
                  />
                  <Link className="min-w-0 flex-1" href={`/installations/${job.id}`}>
                    {/* Badge 는 <div> 라 <p> 안에 넣으면 브라우저가 <p>를 강제로 닫아
                        서버/클라 DOM 이 어긋난다(hydration #418) → <div> 사용 */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {job.scheduled_install_date ?? '미정'}
                      </span>
                      <span className="text-muted-foreground text-xs">{job.visit_time ?? ''}</span>
                      <Badge variant={STATUS_VARIANT[job.status ?? ''] ?? 'outline'}>
                        {STATUS_LABEL[job.status ?? ''] ?? job.status ?? '-'}
                      </Badge>
                    </div>
                    <p className="truncate text-sm">{job.customer_name ?? '-'}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {job.address ?? '-'}
                      {job.technician_name ? ` · ${job.technician_name}` : ' · 미배정'}
                    </p>
                  </Link>
                  <span aria-hidden className="text-muted-foreground text-sm">
                    →
                  </span>
                </div>
              );
            })}
          </div>

          {/* 데스크톱: 표(드래그·Shift 범위선택 지원) */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm select-none">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider">
                <th className="w-9 px-2 py-3">
                  <input
                    aria-label="전체 선택"
                    checked={allSelected}
                    className="size-4 cursor-pointer align-middle"
                    onChange={toggleAll}
                    type="checkbox"
                  />
                </th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">시공일자</th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">방문시간</th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">성함</th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">주소</th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">담당자</th>
                <th className="text-muted-foreground px-2 py-3 text-left font-semibold">상태</th>
                <th className="px-2 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => {
                const isSelected = selected.has(job.id);
                return (
                  <tr
                    className={`border-b transition-colors last:border-0 ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                    key={job.id}
                    onPointerEnter={() => onRowPointerEnter(index)}
                  >
                    <td className="px-2 py-3">
                      <input
                        aria-label={`${job.customer_name ?? '시공'} 선택`}
                        checked={isSelected}
                        className="size-4 cursor-pointer touch-none align-middle"
                        onChange={() => undefined /* 상태는 pointerdown 에서 처리(드래그/Shift 지원) */}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          onCheckPointerDown(index, e);
                        }}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-2 py-3 font-medium tabular-nums">
                      {job.scheduled_install_date ?? '미정'}
                    </td>
                    <td className="text-muted-foreground px-2 py-3">{job.visit_time ?? '-'}</td>
                    <td className="px-2 py-3">{job.customer_name ?? '-'}</td>
                    <td className="text-muted-foreground max-w-xs truncate px-2 py-3">
                      {job.address ?? '-'}
                    </td>
                    <td className="px-2 py-3">
                      {job.technician_name ?? <span className="text-muted-foreground italic">미배정</span>}
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant={STATUS_VARIANT[job.status ?? ''] ?? 'outline'}>
                        {STATUS_LABEL[job.status ?? ''] ?? job.status ?? '-'}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Link
                        className="text-primary hover:bg-primary/5 inline-flex items-center rounded px-2 py-1 text-xs font-medium hover:underline"
                        href={`/installations/${job.id}`}
                      >
                        상세 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
