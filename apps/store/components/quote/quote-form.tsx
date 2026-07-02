'use client';

import { useMemo, useState, type ReactElement } from 'react';

/**
 * S6 대량 견적요청 폼 — UI 전용.
 *
 * TODO(R3): 제출은 현재 disabled. server action 연결 시:
 *   1) phone 은 이미 숫자만 남기도록 정규화됨(아래 onChange). store_quote_requests.phone 의
 *      DB CHECK 가 숫자만 허용(하이픈 불허)하므로 제출 직전 digitsOnly 값을 그대로 전송.
 *   2) 서버에서 zod 재검증(상호/담당자 1~100, phone 01X 10~11자리, message 1~1000).
 *   3) 성공 시 완료 상태 표시 + PostHog `store_quote_submit` 이벤트.
 */

const LIMITS = {
  company: { min: 1, max: 100 },
  contact: { min: 1, max: 100 },
  message: { min: 1, max: 1000 },
} as const;

// DB CHECK(0021_store.sql: ^01[016789][0-9]{7,8}$)와 접두 일치 유지 — R3 server action zod와 공유 상수화 권장
const PHONE_PREFIX_RE = /^01[016789]/;

interface FormState {
  company: string;
  contact: string;
  phone: string; // digits only
  message: string;
}

interface FieldErrors {
  company?: string;
  contact?: string;
  phone?: string;
  message?: string;
}

const EMPTY: FormState = { company: '', contact: '', phone: '', message: '' };

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {};

  const company = state.company.trim();
  if (company.length < LIMITS.company.min) errors.company = '상호를 입력해 주세요.';
  else if (company.length > LIMITS.company.max) errors.company = '상호는 100자 이내로 입력해 주세요.';

  const contact = state.contact.trim();
  if (contact.length < LIMITS.contact.min) errors.contact = '담당자명을 입력해 주세요.';
  else if (contact.length > LIMITS.contact.max)
    errors.contact = '담당자명은 100자 이내로 입력해 주세요.';

  const phone = state.phone;
  if (phone.length === 0) errors.phone = '휴대폰 번호를 입력해 주세요.';
  else if (phone.length < 10 || phone.length > 11)
    errors.phone = '휴대폰 번호 10~11자리를 정확히 입력해 주세요.';
  else if (!PHONE_PREFIX_RE.test(phone)) errors.phone = '01로 시작하는 휴대폰 번호를 입력해 주세요.';

  const message = state.message.trim();
  if (message.length < LIMITS.message.min) errors.message = '문의 내용을 입력해 주세요.';
  else if (message.length > LIMITS.message.max)
    errors.message = '문의 내용은 1,000자 이내로 입력해 주세요.';

  return errors;
}

export function QuoteForm(): ReactElement {
  const [state, setState] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    company: false,
    contact: false,
    phone: false,
    message: false,
  });

  const errors = useMemo(() => validate(state), [state]);

  const update =
    (field: keyof FormState) =>
    (value: string): void => {
      const next = field === 'phone' ? value.replace(/\D/g, '').slice(0, 11) : value;
      setState((prev) => ({ ...prev, [field]: next }));
    };

  const markTouched = (field: keyof FormState) => (): void =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const showError = (field: keyof FormState): string | undefined =>
    touched[field] ? errors[field] : undefined;

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // TODO(R3): server action 호출. 현재는 제출 비활성.
      }}
    >
      <Field
        label="상호"
        htmlFor="company"
        required
        count={state.company.length}
        max={LIMITS.company.max}
        error={showError('company')}
      >
        <input
          id="company"
          name="company"
          type="text"
          inputMode="text"
          autoComplete="organization"
          maxLength={LIMITS.company.max}
          value={state.company}
          onChange={(e) => update('company')(e.target.value)}
          onBlur={markTouched('company')}
          placeholder="예: 대한종합설비"
          className={inputCls(showError('company'))}
        />
      </Field>

      <Field
        label="담당자명"
        htmlFor="contact"
        required
        count={state.contact.length}
        max={LIMITS.contact.max}
        error={showError('contact')}
      >
        <input
          id="contact"
          name="contact"
          type="text"
          autoComplete="name"
          maxLength={LIMITS.contact.max}
          value={state.contact}
          onChange={(e) => update('contact')(e.target.value)}
          onBlur={markTouched('contact')}
          placeholder="예: 김현장"
          className={inputCls(showError('contact'))}
        />
      </Field>

      <Field
        label="휴대폰"
        htmlFor="phone"
        required
        error={showError('phone')}
        hint="하이픈(-) 없이 숫자만 입력해 주세요. 예: 01012345678"
      >
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          value={state.phone}
          onChange={(e) => update('phone')(e.target.value)}
          onBlur={markTouched('phone')}
          placeholder="01012345678"
          className={inputCls(showError('phone'))}
        />
      </Field>

      <Field
        label="문의 내용"
        htmlFor="message"
        required
        count={state.message.length}
        max={LIMITS.message.max}
        error={showError('message')}
        hint="필요 품목·수량·납기·배송지 등을 적어주시면 더 정확한 단가를 드립니다."
      >
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={LIMITS.message.max}
          value={state.message}
          onChange={(e) => update('message')(e.target.value)}
          onBlur={markTouched('message')}
          placeholder="예: 무타공 브라켓 스탠다드 월 30개 정기 발주 가능한지, 세금계산서 발행 조건 문의드립니다."
          className={`${inputCls(showError('message'))} min-h-[120px] resize-y`}
        />
      </Field>

      {/* TODO(R3): server action 연결 시 disabled 해제 + 로딩/완료 상태 처리 */}
      <button
        type="submit"
        disabled
        aria-disabled="true"
        className="bg-primary/40 text-primary-foreground flex h-12 w-full cursor-not-allowed items-center justify-center rounded-md text-sm font-semibold"
      >
        견적 접수 · 준비 중
      </button>
      <p className="text-muted-foreground text-center text-xs leading-5">
        접수 기능은 준비 중입니다. 곧 남겨주신 연락처로 담당자가 회신드립니다.
      </p>
    </form>
  );
}

function inputCls(error?: string): string {
  return [
    'w-full rounded-lg border bg-background px-3.5 py-3 text-[15px] outline-none transition-colors',
    'placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring focus:ring-offset-0',
    error ? 'border-destructive' : 'border-input',
  ].join(' ');
}

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  count?: number;
  max?: number;
  error?: string;
  hint?: string;
  children: ReactElement;
}

function Field({
  label,
  htmlFor,
  required,
  count,
  max,
  error,
  hint,
  children,
}: FieldProps): ReactElement {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {typeof count === 'number' && typeof max === 'number' && (
          <span className="text-muted-foreground tabular text-xs">
            {count.toLocaleString('ko-KR')}/{max.toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-xs leading-5" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs leading-5">{hint}</p>
      ) : null}
    </div>
  );
}
