'use client';

import { formatCurrencyKRW, formatDateTimeKST } from '@mount/lib/format';
import { AlertCircle, ExternalLink, Loader2, Search } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Field, inputCls } from '@/components/form/field';
import { StatusTimeline } from '@/components/order/status-timeline';
import { carrierLabel, carrierTrackingUrl } from '@/lib/carriers';
import { normalizePhoneDigits } from '@/lib/order-validation';
import { lookupOrderAction } from '@/app/order/lookup/actions';
import type { LookupOrder } from '@/lib/lookup-service';

export function LookupForm(): ReactElement {
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ orderNo?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<LookupOrder | null>(null);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    setFormError(undefined);
    setOrder(null);

    try {
      const result = await lookupOrderAction({ orderNo, phone });
      if (result.ok) {
        setOrder(result.order);
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.formError);
      }
    } catch {
      setFormError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const trackingUrl = order?.shipment
    ? carrierTrackingUrl(order.shipment.carrier, order.shipment.tracking_no)
    : null;

  return (
    <div className="space-y-8">
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        <Field
          label="주문번호"
          htmlFor="orderNo"
          required
          error={errors.orderNo}
          hint="예: WP260703-483920"
        >
          <input
            id="orderNo"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
            placeholder="WP260703-483920"
            autoCapitalize="characters"
            className={`${inputCls(errors.orderNo)} tabular`}
          />
        </Field>
        <Field
          label="휴대폰"
          htmlFor="lookupPhone"
          required
          error={errors.phone}
          hint="주문 시 입력한 번호 · 숫자만"
        >
          <input
            id="lookupPhone"
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(normalizePhoneDigits(e.target.value).slice(0, 11))}
            placeholder="01012345678"
            className={inputCls(errors.phone)}
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
              조회 중…
            </>
          ) : (
            <>
              <Search className="size-4" aria-hidden />
              주문 조회
            </>
          )}
        </button>
      </form>

      {order && (
        <section className="space-y-6 rounded-2xl border border-border p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-muted-foreground text-xs">주문번호</p>
              <p className="tabular text-lg font-bold">{order.order_no}</p>
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDateTimeKST(order.created_at)}
            </p>
          </div>

          <StatusTimeline status={order.status} />

          {order.shipment && (
            <div className="rounded-xl border border-input p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">택배사</span>
                <span className="font-medium">{carrierLabel(order.shipment.carrier)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">운송장</span>
                <span className="tabular font-medium">{order.shipment.tracking_no}</span>
              </div>
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-input py-2.5 text-sm font-semibold"
                >
                  배송 추적
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-input pt-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground"> · {item.variant}</span>
                  <span className="text-muted-foreground tabular"> × {item.qty}</span>
                </span>
                <span className="tabular shrink-0 font-medium">
                  {formatCurrencyKRW(item.subtotal)}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-input pt-2.5">
              <span className="font-semibold">총액</span>
              <span className="tabular text-lg font-bold">
                {formatCurrencyKRW(order.total_amount)}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
