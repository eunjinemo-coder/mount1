'use client';

/**
 * 구글시트 연동 관리 UI (클라이언트) — 연결 추가/토글/재시도.
 * 서버가 넘긴 초기 데이터(links)를 렌더하고, server action 호출 후 router.refresh.
 * 어드민 정숙 규율: 장식 채움 없이 상태·행동만.
 */
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { RefreshCw, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import {
  DEFAULT_INSTALLATION_COLUMN_MAP,
  DEFAULT_INSTALLATION_SYNC_ID_COLUMN,
} from '@/lib/sheets/mapping';
import {
  connectSheetAction,
  retryFailedSyncAction,
  toggleSheetActiveAction,
} from './actions';

export interface SheetLinkView {
  id: string;
  spreadsheetId: string;
  sheetName: string;
  entity: string;
  active: boolean;
  columnCount: number;
  pending: number;
  failed: number;
}

/** 은진님 양식 A~M 기본 매핑(프리셋). 확인만 하면 되도록 버튼으로 채운다. */
const DEFAULT_MAP_JSON = JSON.stringify(DEFAULT_INSTALLATION_COLUMN_MAP, null, 2);
const COLUMN_MAP_PLACEHOLDER = DEFAULT_MAP_JSON;

export function SheetsManager({ links }: { links: SheetLinkView[] }): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    spreadsheetUrl: '',
    sheetName: '',
    columnMapJson: '',
    syncIdColumn: DEFAULT_INSTALLATION_SYNC_ID_COLUMN,
  });

  function refresh(): void {
    router.refresh();
  }

  function submitConnect(): void {
    setError(null);
    startTransition(async () => {
      const res = await connectSheetAction({
        spreadsheetUrl: form.spreadsheetUrl,
        sheetName: form.sheetName,
        columnMapJson: form.columnMapJson,
        syncIdColumn: form.syncIdColumn,
      });
      if (!res.ok) setError(res.error ?? '연결 실패');
      else {
        setForm({
          spreadsheetUrl: '',
          sheetName: '',
          columnMapJson: '',
          syncIdColumn: DEFAULT_INSTALLATION_SYNC_ID_COLUMN,
        });
        refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 연결된 시트 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">연결된 시트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.length === 0 ? (
            <p className="text-muted-foreground text-sm">아직 연결된 시트가 없습니다. 아래에서 추가하세요.</p>
          ) : (
            links.map((link) => (
              <div
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {link.sheetName}
                    {link.active ? (
                      <Badge>활성</Badge>
                    ) : (
                      <Badge variant="secondary">중지</Badge>
                    )}
                    {link.failed > 0 ? (
                      <Badge variant="destructive">시트 동기화 {link.failed}건 실패</Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                    {link.spreadsheetId.slice(0, 18)}… · 매핑 {link.columnCount}열 · 대기 {link.pending}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {link.failed > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await retryFailedSyncAction(link.id);
                          refresh();
                        })
                      }
                    >
                      <RefreshCw className="mr-1 size-3.5" aria-hidden />
                      재시도
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={link.active ? 'outline' : 'default'}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleSheetActiveAction(link.id, !link.active);
                        refresh();
                      })
                    }
                  >
                    {link.active ? '동기화 중지' : '동기화 켜기'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 새 시트 연결 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 시트 연결</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs" htmlFor="ss-url">
              구글시트 URL
            </label>
            <Input
              id="ss-url"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              value={form.spreadsheetUrl}
              onChange={(e) => setForm({ ...form, spreadsheetUrl: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs" htmlFor="ss-tab">
                탭 이름
              </label>
              <Input
                id="ss-tab"
                placeholder="시공"
                value={form.sheetName}
                onChange={(e) => setForm({ ...form, sheetName: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs" htmlFor="ss-sync">
                _sync_id 숨김열
              </label>
              <Input
                id="ss-sync"
                placeholder={DEFAULT_INSTALLATION_SYNC_ID_COLUMN}
                value={form.syncIdColumn}
                onChange={(e) => setForm({ ...form, syncIdColumn: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs" htmlFor="ss-map">
                열 매핑 (JSON · 시트 열문자 → 앱 필드)
              </label>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    columnMapJson: DEFAULT_MAP_JSON,
                    syncIdColumn: DEFAULT_INSTALLATION_SYNC_ID_COLUMN,
                  }))
                }
              >
                <Wand2 className="mr-1 size-3.5" aria-hidden />
                은진님 양식(A~M) 기본값 채우기
              </Button>
            </div>
            <textarea
              id="ss-map"
              className="border-input bg-background min-h-40 rounded-md border px-3 py-2 font-mono text-xs"
              placeholder={COLUMN_MAP_PLACEHOLDER}
              value={form.columnMapJson}
              onChange={(e) => setForm({ ...form, columnMapJson: e.target.value })}
            />
            <p className="text-muted-foreground text-xs leading-6">
              A 시공일자 · B 접수일자 · C 이사일자 · D 방문시간 · E 담당자 · F 연락처 · G 연락처2 · H
              주소 · I 상세주소 · J 성함 · K 타입 · L 설치내용 · M 특이사항 (13열 전부 양방향). 상태는
              앱에서만 관리하므로 시트 매핑 대상이 아닙니다. _sync_id 숨김열은 데이터열과 겹치지 않는
              열(예: {DEFAULT_INSTALLATION_SYNC_ID_COLUMN})을 사용하세요.
            </p>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button onClick={submitConnect} disabled={pending}>
            {pending ? '저장 중…' : '시트 연결'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
