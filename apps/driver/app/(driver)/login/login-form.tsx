'use client';

import type { SignInResult } from '@mount/lib';
import { toSafeRedirectPath } from '@mount/lib';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState, useTransition, type ReactElement } from 'react';
import { loginAction } from './actions';

export interface LoginFormProps {
  error?: string;
  redirect?: string;
}

const initialState: SignInResult = { ok: false };

export function LoginForm(props: LoginFormProps): ReactElement {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [state, submitAction] = React.useActionState(
    async (_previousState: SignInResult, formData: FormData) => loginAction(formData),
    initialState,
  );

  const isPending = isSubmitting;
  const errorMessage = dismissedError ? state.error : state.error || props.error;

  useEffect(() => {
    if (state.ok) {
      window.location.href = toSafeRedirectPath(props.redirect) ?? state.redirect ?? '/';
    }
  }, [props.redirect, state.ok, state.redirect]);

  return (
    <Card className="w-full border-border/80 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">기사 로그인</CardTitle>
        <p className="text-muted-foreground text-sm leading-6">
          발급받은 아이디와 비밀번호를 입력해 주세요.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setDismissedError(false);
            startTransition(() => {
              submitAction(new FormData(event.currentTarget));
            });
          }}
        >
          <input name="redirect" type="hidden" value={props.redirect ?? ''} />
          <label className="block space-y-2">
            <span className="text-sm font-medium">아이디</span>
            <Input
              autoComplete="username"
              className="h-12 text-base"
              inputMode="text"
              maxLength={32}
              name="username"
              onChange={(event) => {
                setUsername(event.target.value);
                setDismissedError(true);
              }}
              placeholder="아이디를 입력해 주세요"
              required
              value={username}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">비밀번호</span>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="h-12 pr-12 text-base"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setDismissedError(true);
                }}
                placeholder="비밀번호를 입력해 주세요"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                type="button"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </label>
          {errorMessage ? (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <Button className="h-12 w-full text-base" disabled={isPending} size="lg" type="submit">
            {isPending ? '로그인 중…' : '로그인'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
