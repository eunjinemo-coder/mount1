'use client';

import { formatCurrencyKRW } from '@mount/lib/format';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Minus, Plus, TrendingDown, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Field, inputCls } from '@/components/form/field';
import { BANK_ACCOUNT, PAYMENT_DEADLINE_HOURS } from '@/lib/bank-info';
import type { OrderCatalog, OrderVariant } from '@/lib/order-catalog';
import { LIMITS, normalizePhoneDigits } from '@/lib/order-validation';
import { calcTotalSavings, calcUnitSavings, resolveUnitPrice } from '@/lib/pricing';
import { submitOrderAction } from '@/app/order/actions';

/** 재방문 구매자용 배송정보 재사용 — 카드·비밀정보 아님(민감정보 저장 없음). */
const BUYER_INFO_STORAGE_KEY = 'mount-store:buyer-info-v1';

interface SavedBuyerInfo {
  buyerName: string;
  buyerPhone: string;
  buyerCompany: string;
  shipPostcode: string;
  shipAddr1: string;
  shipAddr2: string;
}

function loadSavedBuyerInfo(): SavedBuyerInfo | null {
  try {
    const raw = window.localStorage.getItem(BUYER_INFO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedBuyerInfo) : null;
  } catch {
    return null; // 파싱 실패·프라이빗 모드 등 — 프리필 없이 진행
  }
}

function saveBuyerInfo(info: SavedBuyerInfo): void {
  try {
    window.localStorage.setItem(BUYER_INFO_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // 저장 공간 부족 등 — 핵심 기능(주문 제출) 아니므로 조용히 무시
  }
}

function clearSavedBuyerInfo(): void {
  try {
    window.localStorage.removeItem(BUYER_INFO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const QTY_PRESETS = [10, 25, 50] as const;

type FieldKey =
  | 'buyerName'
  | 'buyerPhone'
  | 'buyerCompany'
  | 'bizRegNo'
  | 'shipPostcode'
  | 'shipAddr1'
  | 'shipAddr2'
  | 'shipMemo'
  | 'depositorName'
  | 'items';

interface Props {
  catalog: OrderCatalog;
}

export function OrderForm({ catalog }: Props): ReactElement {
  const router = useRouter();
  // 멱등키 — 마운트 시 1회 생성, 재시도에도 동일값 재사용(이중제출 차단)
  const [clientKey] = useState<string>(() => crypto.randomUUID());

  const [variantId, setVariantId] = useState<string>(catalog.variants[0]?.variantId ?? '');
  const [qty, setQty] = useState<number>(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [taxInvoice, setTaxInvoice] = useState(false);
  const [bizRegNo, setBizRegNo] = useState('');
  const [shipPostcode, setShipPostcode] = useState('');
  const [shipAddr1, setShipAddr1] = useState('');
  const [shipAddr2, setShipAddr2] = useState('');
  const [shipMemo, setShipMemo] = useState('');
  const [depositorName, setDepositorName] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // 재방문 구매자 프리필 — 마운트 시 1회, 클라이언트에서만(SSR 미접근)
  useEffect(() => {
    const saved = loadSavedBuyerInfo();
    if (!saved) return;
    setBuyerName(saved.buyerName);
    setBuyerPhone(saved.buyerPhone);
    setBuyerCompany(saved.buyerCompany);
    setShipPostcode(saved.shipPostcode);
    setShipAddr1(saved.shipAddr1);
    setShipAddr2(saved.shipAddr2);
    setPrefilled(true);
  }, []);

  const clearPrefill = (): void => {
    clearSavedBuyerInfo();
    setBuyerName('');
    setBuyerPhone('');
    setBuyerCompany('');
    setShipPostcode('');
    setShipAddr1('');
    setShipAddr2('');
    setPrefilled(false);
  };

  const variant: OrderVariant | undefined = useMemo(
    () => catalog.variants.find((v) => v.variantId === variantId) ?? catalog.variants[0],
    [catalog.variants, variantId],
  );

  const maxQty = Math.max(1, variant?.stock ?? 1);
  const unitPrice = variant ? resolveUnitPrice(variant.basePrice, variant.tiers, qty) : 0;
  const total = unitPrice * qty;
  const unitSavings = variant ? calcUnitSavings(variant.basePrice, unitPrice) : 0;
  const totalSavings = variant ? calcTotalSavings(variant.basePrice, unitPrice, qty) : 0;

  const clampQty = (next: number): void => {
    if (Number.isNaN(next)) return;
    setQty(Math.min(maxQty, Math.max(1, Math.floor(next))));
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting || !catalog.seeded || !variant) return;
    setSubmitting(true);
    setErrors({});
    setFormError(undefined);

    try {
      const result = await submitOrderAction({
        clientKey,
        slug: catalog.slug,
        items: [{ variantId: variant.variantId, qty }],
        buyerName,
        buyerPhone,
        buyerCompany,
        taxInvoice,
        bizRegNo,
        shipPostcode,
        shipAddr1,
        shipAddr2,
        shipMemo,
        depositorName,
      });

      if (result.ok) {
        saveBuyerInfo({ buyerName, buyerPhone, buyerCompany, shipPostcode, shipAddr1, shipAddr2 });
        router.push(`/order/done/${result.orderNo}` as Route);
        return; // 리다이렉트 중 submitting 유지(중복 클릭 방지)
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.formError);
      setSubmitting(false);
    } catch {
      // 네트워크/서버 예외: 새로고침을 유도하지 않고 같은 마운트(같은 clientKey)로 재시도하게 한다.
      // 첫 요청이 서버에서 성공했더라도 동일 clientKey 재전송 → create_store_order 멱등이 기존 주문 반환.
      setFormError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-8" noValidate onSubmit={onSubmit}>
      {!catalog.seeded && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          실 상품 데이터 연동 준비 중입니다. 지금은 금액·구성 미리보기만 가능하며, 곧 바로 주문
          접수가 열립니다.
        </p>
      )}

      {/* 상품·수량 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold">상품 · 수량</h2>

        {catalog.variants.length > 1 && (
          <div className="grid gap-2">
            {catalog.variants.map((v) => (
              <button
                key={v.variantId || v.sku}
                type="button"
                onClick={() => setVariantId(v.variantId)}
                className={[
                  'flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  v.variantId === variantId ? 'border-primary bg-primary/5' : 'border-input',
                ].join(' ')}
              >
                <span className="font-medium">{v.name}</span>
                <span className="tabular text-muted-foreground">
                  {formatCurrencyKRW(v.basePrice)}부터
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-input p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{variant?.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                재고 {maxQty.toLocaleString('ko-KR')}개 · {maxQty}개까지 주문 가능
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="수량 감소"
                onClick={() => clampQty(qty - 1)}
                className="flex size-9 items-center justify-center rounded-md border border-input disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label="수량"
                value={qty}
                onChange={(e) => clampQty(Number(e.target.value.replace(/\D/g, '')))}
                className="tabular h-9 w-24 rounded-md border border-input text-center text-[15px] outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                aria-label="수량 증가"
                onClick={() => clampQty(qty + 1)}
                className="flex size-9 items-center justify-center rounded-md border border-input disabled:opacity-40"
                disabled={qty >= maxQty}
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* 대량 구매 바로가기 — 재고 내에서만 노출 */}
          <div className="mt-3 flex gap-2">
            {QTY_PRESETS.filter((preset) => preset <= maxQty).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => clampQty(preset)}
                aria-pressed={qty === preset}
                className={[
                  'flex h-11 flex-1 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                  qty === preset ? 'border-primary bg-primary/5 text-primary' : 'border-input',
                ].join(' ')}
              >
                {preset}개
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-input pt-3">
            <span className="text-sm font-semibold">총 결제금액</span>
            <span className="tabular text-2xl font-bold">{formatCurrencyKRW(total)}</span>
          </div>
          <p className="text-muted-foreground tabular mt-1 text-right text-xs">
            개당 {formatCurrencyKRW(unitPrice)} × {qty.toLocaleString('ko-KR')}개
          </p>
          {unitSavings > 0 && (
            <div className="text-success mt-2 flex items-center justify-end gap-1.5 text-sm font-medium">
              <TrendingDown className="size-4 shrink-0" aria-hidden />
              <span className="tabular">
                개당 {formatCurrencyKRW(unitSavings)} · 총 {formatCurrencyKRW(totalSavings)} 절감
              </span>
            </div>
          )}
          {errors.items && (
            <p className="text-destructive mt-2 text-xs leading-5" role="alert">
              {errors.items}
            </p>
          )}
        </div>
      </section>

      {/* 주문자 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold">주문자 정보</h2>
        {prefilled && (
          <p className="bg-muted/40 text-muted-foreground flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-xs leading-5">
            <span>저장된 정보로 채웠어요</span>
            <button
              type="button"
              onClick={clearPrefill}
              className="text-foreground shrink-0 underline underline-offset-2"
            >
              지우기
            </button>
          </p>
        )}
        <Field label="이름" htmlFor="buyerName" required error={errors.buyerName}>
          <input
            id="buyerName"
            autoComplete="name"
            maxLength={LIMITS.name.max}
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="예: 김현장"
            className={inputCls(errors.buyerName)}
          />
        </Field>
        <Field
          label="휴대폰"
          htmlFor="buyerPhone"
          required
          error={errors.buyerPhone}
          hint="하이픈(-) 없이 숫자만. 예: 01012345678"
        >
          <input
            id="buyerPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(normalizePhoneDigits(e.target.value).slice(0, 11))}
            placeholder="01012345678"
            className={inputCls(errors.buyerPhone)}
          />
        </Field>
        <Field label="상호 (선택)" htmlFor="buyerCompany" error={errors.buyerCompany}>
          <input
            id="buyerCompany"
            autoComplete="organization"
            maxLength={LIMITS.company.max}
            value={buyerCompany}
            onChange={(e) => setBuyerCompany(e.target.value)}
            placeholder="사업자 구매 시"
            className={inputCls(errors.buyerCompany)}
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-lg border border-input px-4 py-3">
          <input
            type="checkbox"
            checked={taxInvoice}
            onChange={(e) => setTaxInvoice(e.target.checked)}
            className="size-4"
          />
          <span className="text-sm font-medium">세금계산서 발행 요청</span>
        </label>
        {taxInvoice && (
          <Field
            label="사업자등록번호"
            htmlFor="bizRegNo"
            required
            error={errors.bizRegNo}
            hint="숫자 10자리"
          >
            <input
              id="bizRegNo"
              inputMode="numeric"
              maxLength={12}
              value={bizRegNo}
              onChange={(e) => setBizRegNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="0000000000"
              className={inputCls(errors.bizRegNo)}
            />
          </Field>
        )}
      </section>

      {/* 배송지 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold">배송지</h2>
        <Field label="우편번호" htmlFor="shipPostcode" required error={errors.shipPostcode}>
          <input
            id="shipPostcode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={LIMITS.postcode.max}
            value={shipPostcode}
            onChange={(e) => setShipPostcode(e.target.value)}
            placeholder="12345"
            className={inputCls(errors.shipPostcode)}
          />
        </Field>
        <Field label="주소" htmlFor="shipAddr1" required error={errors.shipAddr1}>
          <input
            id="shipAddr1"
            autoComplete="address-line1"
            maxLength={LIMITS.addr1.max}
            value={shipAddr1}
            onChange={(e) => setShipAddr1(e.target.value)}
            placeholder="도로명 주소"
            className={inputCls(errors.shipAddr1)}
          />
        </Field>
        <Field label="상세주소 (선택)" htmlFor="shipAddr2" error={errors.shipAddr2}>
          <input
            id="shipAddr2"
            autoComplete="address-line2"
            maxLength={LIMITS.addr2.max}
            value={shipAddr2}
            onChange={(e) => setShipAddr2(e.target.value)}
            placeholder="동·호수 등"
            className={inputCls(errors.shipAddr2)}
          />
        </Field>
        <Field
          label="배송 메모 (선택)"
          htmlFor="shipMemo"
          count={shipMemo.length}
          max={LIMITS.memo.max}
          error={errors.shipMemo}
        >
          <textarea
            id="shipMemo"
            rows={2}
            maxLength={LIMITS.memo.max}
            value={shipMemo}
            onChange={(e) => setShipMemo(e.target.value)}
            placeholder="부재 시 문 앞 등"
            className={`${inputCls(errors.shipMemo)} resize-y`}
          />
        </Field>
      </section>

      {/* 결제 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold">결제</h2>
        <div className="rounded-lg border border-input bg-muted/30 px-4 py-3 text-sm leading-6">
          <p className="font-semibold">무통장입금</p>
          <p className="text-muted-foreground mt-1">
            주문 완료 후 안내되는 계좌로 <b>{PAYMENT_DEADLINE_HOURS}시간 이내</b> 입금해 주세요.
            입금 확인 후 출고됩니다. (입금 계좌: {BANK_ACCOUNT.bankName})
          </p>
        </div>
        <Field
          label="입금자명 (선택)"
          htmlFor="depositorName"
          error={errors.depositorName}
          hint="주문자와 다를 경우 입력"
        >
          <input
            id="depositorName"
            maxLength={LIMITS.depositor.max}
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            placeholder="입금자 성함"
            className={inputCls(errors.depositorName)}
          />
        </Field>
      </section>

      {formError && (
        <p className="text-destructive rounded-lg bg-destructive/10 px-4 py-3 text-sm" role="alert">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !catalog.seeded}
        aria-disabled={submitting || !catalog.seeded}
        className="bg-primary text-primary-foreground flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            접수 중…
          </>
        ) : (
          `${formatCurrencyKRW(total)} 주문 접수`
        )}
      </button>
      <p className="text-muted-foreground text-center text-xs leading-5">
        주문 접수 시 입력하신 정보로 주문이 생성되며, 계좌·금액이 SMS로 안내됩니다.
      </p>
    </form>
  );
}
