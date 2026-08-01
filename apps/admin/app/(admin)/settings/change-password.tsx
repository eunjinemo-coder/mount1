'use client';

/** 비밀번호 변경 폼 — 현재 비번 재확인 후 변경. 성공/실패를 화면에 명확히 표시. */
import { Button, Input } from '@mount/ui';
import { useState, useTransition, type ReactElement } from 'react';
import { changeMyPasswordAction } from './actions';

export function ChangePasswordForm(): ReactElement {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(): void {
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }
    startTransition(async () => {
      const res = await changeMyPasswordAction(current, next);
      if (!res.ok) {
        setError(res.error ?? '변경 실패');
        return;
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    });
  }

  return (
    <form
      className="grid max-w-sm gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="pw-current">
          현재 비밀번호
        </label>
        <Input
          autoComplete="current-password"
          id="pw-current"
          onChange={(e) => setCurrent(e.target.value)}
          type="password"
          value={current}
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="pw-new">
          새 비밀번호 (8자 이상)
        </label>
        <Input
          autoComplete="new-password"
          id="pw-new"
          onChange={(e) => setNext(e.target.value)}
          type="password"
          value={next}
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="pw-confirm">
          새 비밀번호 확인
        </label>
        <Input
          autoComplete="new-password"
          id="pw-confirm"
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          value={confirm}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {done ? <p className="text-sm font-medium text-emerald-600">비밀번호가 변경되었습니다.</p> : null}
      <div>
        <Button disabled={pending} type="submit">
          {pending ? '변경 중…' : '비밀번호 변경'}
        </Button>
      </div>
    </form>
  );
}
