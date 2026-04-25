'use client';

import type { SignInResult } from '@mount/lib';
import { toSafeRedirectPath } from '@mount/lib';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@mount/ui';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState, useTransition, type ReactElement } from 'react';
import { adminLoginAction } from './actions';

export interface AdminLoginFormProps {
  error?: string;
  redirect?: string;
}

const initialState: SignInResult = { ok: false };

const ROLE_OPTIONS = [
  { value: 'super_admin', label: '대표' },
  { value: 'cs_admin', label: '본사CS' },
  { value: 'dispatch_admin', label: '배차담당' },
  { value: 'ops_admin', label: '쿠팡CS' },
  { value: 'auditor', label: '감사' },
] as const;

export function AdminLoginForm(props: AdminLoginFormProps): ReactElement {
  const [adminRole, setAdminRole] = useState('cs_admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [state, submitAction] = React.useActionState(
    async (_previousState: SignInResult, formData: FormData) => adminLoginAction(formData),
    initialState,
  );

  const errorMessage = dismissedError ? state.error : state.error || props.error;
  const isLocked = errorMessage?.includes('잠겼') || errorMessage?.includes('잠금');

  useEffect(() => {
    if (state.ok) {
      window.location.href = toSafeRedirectPath(props.redirect) ?? state.redirect ?? '/';
    }
  }, [props.redirect, state.ok, state.redirect]);

  return (
    <Card className="border-border/80 w-full shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">로그인</CardTitle>
        <CardDescription>발급받은 역할 / 아이디 / 비밀번호를 입력해 주세요.</CardDescription>
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
          <label className="block space-y-2">
            <span className="text-sm font-medium">역할</span>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              name="adminRole"
              onChange={(event) => {
                setAdminRole(event.target.value);
                setDismissedError(true);
              }}
              value={adminRole}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">아이디</span>
            <Input
              autoComplete="username"
              maxLength={32}
              name="username"
              onChange={(event) => {
                setUsername(event.target.value);
                setDismissedError(true);
              }}
              placeholder="발급된 아이디"
              required
              value={username}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">비밀번호</span>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="pr-12"
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setDismissedError(true);
                }}
                placeholder="비밀번호"
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
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
          {errorMessage ? (
            <div className="border-destructive/30 bg-destructive/10 mt-2 rounded-md border px-3 py-2">
              <p className="text-destructive text-sm">{errorMessage}</p>
              {isLocked ? (
                <p className="text-destructive/80 mt-1 text-xs">
                  10분 후 다시 시도하거나, 본사 CS 에 잠금 해제 요청 (kakao 채널).
                </p>
              ) : null}
            </div>
          ) : null}
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? '로그인 중…' : '로그인'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
