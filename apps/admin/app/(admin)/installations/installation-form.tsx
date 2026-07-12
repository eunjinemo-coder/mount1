'use client';

/**
 * 시공 생성/편집 폼(클라이언트) — 시트 A~M 13필드 + 앱 내부 상태.
 * 어드민 정숙 규율: 흰 배경 + 헤어라인, 장식 채움 없이 입력·상태만.
 */
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mount/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';
import {
  createInstallationJobAction,
  updateInstallationJobAction,
  type InstallationFormInput,
} from './actions';

const EMPTY: InstallationFormInput = {
  scheduled_install_date: '',
  received_date: '',
  move_date: '',
  visit_time: '',
  technician_name: '',
  customer_phone: '',
  customer_phone2: '',
  address: '',
  address_detail: '',
  customer_name: '',
  install_type: '',
  install_content: '',
  special_notes: '',
  status: 'scheduled',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'scheduled', label: '예정' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

export interface InstallationFormProps {
  id?: string;
  initial?: Partial<InstallationFormInput>;
}

export function InstallationForm({ id, initial }: InstallationFormProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InstallationFormInput>({ ...EMPTY, ...initial });

  const set = (key: keyof InstallationFormInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const res = id
        ? await updateInstallationJobAction(id, form)
        : await createInstallationJobAction(form);
      if (!res.ok) {
        setError(res.error ?? '저장 실패');
        return;
      }
      router.push(id ? `/installations/${id}` : '/installations');
      router.refresh();
    });
  }

  const textareaClass =
    'border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일정 · 담당</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="시공일자 (A)" htmlFor="f-sched">
            <Input
              id="f-sched"
              type="date"
              value={form.scheduled_install_date}
              onChange={(e) => set('scheduled_install_date')(e.target.value)}
            />
          </Field>
          <Field label="방문시간 (D · 자유서식)" htmlFor="f-visit">
            <Input
              id="f-visit"
              placeholder="오전 / 14:00 등"
              value={form.visit_time}
              onChange={(e) => set('visit_time')(e.target.value)}
            />
          </Field>
          <Field label="접수일자 (B)" htmlFor="f-recv">
            <Input
              id="f-recv"
              type="date"
              value={form.received_date}
              onChange={(e) => set('received_date')(e.target.value)}
            />
          </Field>
          <Field label="이사일자 (C)" htmlFor="f-move">
            <Input
              id="f-move"
              type="date"
              value={form.move_date}
              onChange={(e) => set('move_date')(e.target.value)}
            />
          </Field>
          <Field label="담당자 (E)" htmlFor="f-tech">
            <Input
              id="f-tech"
              value={form.technician_name}
              onChange={(e) => set('technician_name')(e.target.value)}
            />
          </Field>
          <Field label="상태 (앱 내부 · 시트 미동기화)" htmlFor="f-status">
            <select
              id="f-status"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={form.status}
              onChange={(e) => set('status')(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">고객 · 주소</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="성함 (J)" htmlFor="f-name">
            <Input
              id="f-name"
              value={form.customer_name}
              onChange={(e) => set('customer_name')(e.target.value)}
            />
          </Field>
          <Field label="타입 (K)" htmlFor="f-type">
            <Input
              id="f-type"
              value={form.install_type}
              onChange={(e) => set('install_type')(e.target.value)}
            />
          </Field>
          <Field label="연락처 (F)" htmlFor="f-phone">
            <Input
              id="f-phone"
              value={form.customer_phone}
              onChange={(e) => set('customer_phone')(e.target.value)}
            />
          </Field>
          <Field label="연락처2 (G)" htmlFor="f-phone2">
            <Input
              id="f-phone2"
              value={form.customer_phone2}
              onChange={(e) => set('customer_phone2')(e.target.value)}
            />
          </Field>
          <Field label="주소 (H)" htmlFor="f-addr">
            <Input
              id="f-addr"
              value={form.address}
              onChange={(e) => set('address')(e.target.value)}
            />
          </Field>
          <Field label="상세주소 (I)" htmlFor="f-addr2">
            <Input
              id="f-addr2"
              value={form.address_detail}
              onChange={(e) => set('address_detail')(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">설치내용 · 특이사항</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="설치내용 (L)" htmlFor="f-content">
            <textarea
              id="f-content"
              className={textareaClass}
              value={form.install_content}
              onChange={(e) => set('install_content')(e.target.value)}
            />
          </Field>
          <Field label="특이사항 (M)" htmlFor="f-notes">
            <textarea
              id="f-notes"
              className={textareaClass}
              value={form.special_notes}
              onChange={(e) => set('special_notes')(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? '저장 중…' : id ? '수정 저장' : '시공 등록'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => router.back()}>
          취소
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div className="grid gap-1.5">
      <label className="text-muted-foreground text-xs" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
