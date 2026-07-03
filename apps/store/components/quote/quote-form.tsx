'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import { Field, inputCls } from '@/components/form/field';
import { LIMITS, PHONE_PREFIX_RE, normalizePhoneDigits } from '@/lib/order-validation';
import { submitQuoteAction } from '@/app/quote/actions';

/**
 * S6 대량 견적요청 폼.
 * 검증 상수·정규식은 lib/order-validation 단일 원천 공유(quoteSchema 와 동일 규칙).
 * 제출은 submitQuoteAction(server action) → store_quote_requests anon INSERT.
 */

interface FormState {
  company: string;
  contactName: string;
  phone: string; // digits only
  message: string;
}

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY: FormState = { company: '', contactName: '', phone: '', message: '' };

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {};

  const company = state.company.trim();
  if (company.length < LIMITS.quoteCompany.min) errors.company = '상호를 입력해 주세요.';
  else if (company.length > LIMITS.quoteCompany.max)
    errors.company = '상호는 100자 이내로 입력해 주세요.';

  const contact = state.contactName.trim();
  if (contact.length < LIMITS.quoteContact.min) errors.contactName = '담당자명을 입력해 주세요.';
  else if (contact.length > LIMITS.quoteContact.max)
    errors.contactName = '담당자명은 100자 이내로 입력해 주세요.';

  const phone = state.phone;
  if (phone.length === 0) errors.phone = '휴대폰 번호를 입력해 주세요.';
  else if (phone.length < 10 || phone.length > 11)
    errors.phone = '휴대폰 번호 10~11자리를 정확히 입력해 주세요.';
  else if (!PHONE_PREFIX_RE.test(phone)) errors.phone = '01로 시작하는 휴대폰 번호를 입력해 주세요.';

  const message = state.message.trim();
  if (message.length < LIMITS.quoteMessage.min) errors.message = '문의 내용을 입력해 주세요.';
  else if (message.length > LIMITS.quoteMessage.max)
    errors.message = '문의 내용은 1,000자 이내로 입력해 주세요.';

  return errors;
}

export function QuoteForm(): ReactElement {
  const [state, setState] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    company: false,
    contactName: false,
    phone: false,
    message: false,
  });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const clientErrors = useMemo(() => validate(state), [state]);

  const update =
    (field: FieldKey) =>
    (value: string): void => {
      const next = field === 'phone' ? normalizePhoneDigits(value).slice(0, 11) : value;
      setState((prev) => ({ ...prev, [field]: next }));
      setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const markTouched = (field: FieldKey) => (): void =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const showError = (field: FieldKey): string | undefined =>
    serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setTouched({ company: true, contactName: true, phone: true, message: true });
    if (Object.keys(validate(state)).length > 0) return;

    setSubmitting(true);
    setFormError(undefined);
    setServerErrors({});

    try {
      const result = await submitQuoteAction(state);
      if (result.ok) {
        setDone(true);
      } else {
        setServerErrors(result.fieldErrors ?? {});
        setFormError(result.formError);
      }
    } catch {
      setFormError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <div className="border-border mx-auto flex size-14 items-center justify-center rounded-full border">
          <CheckCircle2 className="text-success size-8" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-bold">견적 문의가 접수됐어요</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-7">
          남겨주신 연락처로 담당자가 회신드립니다. 감사합니다.
        </p>
        <Link
          href="/"
          className="border-input hover:bg-accent mt-6 flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-colors"
        >
          스토어로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Field
        label="상호"
        htmlFor="company"
        required
        count={state.company.length}
        max={LIMITS.quoteCompany.max}
        error={showError('company')}
      >
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          maxLength={LIMITS.quoteCompany.max}
          value={state.company}
          onChange={(e) => update('company')(e.target.value)}
          onBlur={markTouched('company')}
          placeholder="예: 대한종합설비"
          className={inputCls(showError('company'))}
        />
      </Field>

      <Field
        label="담당자명"
        htmlFor="contactName"
        required
        count={state.contactName.length}
        max={LIMITS.quoteContact.max}
        error={showError('contactName')}
      >
        <input
          id="contactName"
          name="contactName"
          type="text"
          autoComplete="name"
          maxLength={LIMITS.quoteContact.max}
          value={state.contactName}
          onChange={(e) => update('contactName')(e.target.value)}
          onBlur={markTouched('contactName')}
          placeholder="예: 김현장"
          className={inputCls(showError('contactName'))}
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
        max={LIMITS.quoteMessage.max}
        error={showError('message')}
        hint="필요 품목·수량·납기·배송지 등을 적어주시면 더 정확한 단가를 드립니다."
      >
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={LIMITS.quoteMessage.max}
          value={state.message}
          onChange={(e) => update('message')(e.target.value)}
          onBlur={markTouched('message')}
          placeholder="예: 무타공 브라켓 스탠다드 월 30개 정기 발주 가능한지, 세금계산서 발행 조건 문의드립니다."
          className={`${inputCls(showError('message'))} min-h-[120px] resize-y`}
        />
      </Field>

      {formError && (
        <p
          className="text-destructive border-destructive/40 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            접수 중…
          </>
        ) : (
          '견적 문의 접수'
        )}
      </button>
      <p className="text-muted-foreground text-center text-xs leading-5">
        접수 후 남겨주신 연락처로 담당자가 회신드립니다.
      </p>
    </form>
  );
}
