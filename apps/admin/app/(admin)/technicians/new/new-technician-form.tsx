'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { Check, Copy, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import {
  createTechnicianAction,
  type CreateTechnicianInput,
  type CreateTechnicianResult,
} from './actions';

const GRADE_OPTIONS = [
  { value: 'bronze' as const, label: '브론즈 (신규)' },
  { value: 'silver' as const, label: '실버 (3개월+)' },
  { value: 'gold' as const, label: '골드 (검증 완료)' },
];

export function NewTechnicianForm(): ReactElement {
  const router = useRouter();
  const [form, setForm] = useState<CreateTechnicianInput>({
    loginId: '',
    displayName: '',
    phone: '',
    grade: 'bronze',
    dailyMaxJobs: 6,
    weekendEnabled: false,
    vehicleNumber: '',
    homeBaseRegion: '',
    preferredRegions: [],
  });
  const [result, setResult] = useState<CreateTechnicianResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await createTechnicianAction({
          ...form,
          vehicleNumber: form.vehicleNumber?.trim() || undefined,
          homeBaseRegion: form.homeBaseRegion?.trim() || undefined,
        });
        if (r.ok) {
          setResult(r);
        } else {
          setError(r.error ?? '등록에 실패했어요.');
        }
      } catch {
        setError('권한이 없거나 서버 오류입니다.');
      }
    });
  };

  const copyCredentials = async (): Promise<void> => {
    if (!result?.loginId || !result.tempPassword) return;
    const text = `아이디: ${result.loginId}\n비밀번호: ${result.tempPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 발급 완료 화면
  if (result?.ok && result.tempPassword && result.loginId) {
    return (
      <Card className="border-success/40">
        <CardHeader>
          <CardTitle className="text-success flex items-center gap-2">
            <Check className="size-5" />
            발급 완료
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            아래 자격증명을 <strong>지금 즉시</strong> LastPass / 1Password 등에 저장하세요.
            <br />
            평문 비밀번호는 이후 다시 확인할 수 없습니다.
          </p>

          <div className="bg-muted space-y-2 rounded-md p-4 font-mono text-sm">
            <div>
              <span className="text-muted-foreground">아이디: </span>
              <span className="font-semibold">{result.loginId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">비밀번호: </span>
              <span className="font-semibold">{result.tempPassword}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={copyCredentials} type="button" variant="outline">
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              {copied ? '복사됨' : '자격증명 복사'}
            </Button>
            <Button
              onClick={() => {
                setResult(null);
                setForm({
                  loginId: '',
                  displayName: '',
                  phone: '',
                  grade: 'bronze',
                  dailyMaxJobs: 6,
                  weekendEnabled: false,
                  vehicleNumber: '',
                  homeBaseRegion: '',
                  preferredRegions: [],
                });
              }}
              type="button"
              variant="secondary"
            >
              계속 등록
            </Button>
            <Button
              onClick={() => router.push('/technicians')}
              type="button"
            >
              목록으로
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" />
          신규 협력기사 발급
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">이름 *</span>
              <Input
                maxLength={32}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="홍길동"
                required
                value={form.displayName}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">로그인 ID *</span>
              <Input
                maxLength={32}
                onChange={(e) => setForm({ ...form, loginId: e.target.value.toLowerCase() })}
                pattern="[a-z][a-z0-9_]{2,31}"
                placeholder="hong_gildong"
                required
                title="영문 소문자 시작, 영문/숫자/_ 3~32자"
                value={form.loginId}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">전화 (010, 하이픈 없이) *</span>
              <Input
                inputMode="numeric"
                maxLength={11}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                pattern="010\d{7,8}"
                placeholder="01012345678"
                required
                value={form.phone}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">등급 *</span>
              <select
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                onChange={(e) =>
                  setForm({ ...form, grade: e.target.value as CreateTechnicianInput['grade'] })
                }
                value={form.grade}
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">일일 한도 *</span>
              <Input
                max={20}
                min={1}
                onChange={(e) => setForm({ ...form, dailyMaxJobs: Number(e.target.value) })}
                required
                type="number"
                value={form.dailyMaxJobs}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                checked={form.weekendEnabled}
                onChange={(e) => setForm({ ...form, weekendEnabled: e.target.checked })}
                type="checkbox"
              />
              <span className="text-sm">주말 시공 가능</span>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">차량번호</span>
              <Input
                maxLength={16}
                onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                placeholder="12가3456 (선택)"
                value={form.vehicleNumber}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">본거지 지역</span>
              <Input
                maxLength={32}
                onChange={(e) => setForm({ ...form, homeBaseRegion: e.target.value })}
                placeholder="서울 강남구 (선택)"
                value={form.homeBaseRegion}
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">선호 지역 (쉼표로 구분)</span>
            <Input
              onChange={(e) =>
                setForm({
                  ...form,
                  preferredRegions: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="서울 강남구, 서울 서초구, 경기 성남시"
              value={form.preferredRegions?.join(', ') ?? ''}
            />
          </label>

          {error ? (
            <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-2">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : null}

          <Button className="w-full md:w-auto" disabled={isPending} type="submit">
            <UserPlus className="mr-2 size-4" />
            {isPending ? '발급 중…' : '계정 발급 + 등록'}
          </Button>

          <p className="text-muted-foreground text-xs">
            발급 시 임시 비밀번호가 자동 생성되며, 다음 화면에서 1회만 표시됩니다.
            등록 완료 후 기사에게 카카오톡 / SMS 로 전달해 주세요.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
