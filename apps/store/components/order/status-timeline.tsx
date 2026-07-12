import { Check, XCircle, Clock } from 'lucide-react';
import type { ReactElement } from 'react';
import { resolveStatusView, TIMELINE_STEPS } from '@/lib/order-status-ui';

interface Props {
  status: string;
}

/**
 * 주문 상태 타임라인 (S5).
 * 정상 흐름은 5단계 진행바, 취소/만료는 종결 배지로 표시.
 */
export function StatusTimeline({ status }: Props): ReactElement {
  const view = resolveStatusView(status);

  if (view.terminal) {
    const isCancel = view.tone === 'cancelled';
    return (
      <div
        className={[
          'flex items-center gap-3 rounded-xl border p-4',
          isCancel ? 'border-destructive/40' : 'border-warning/40',
        ].join(' ')}
      >
        {isCancel ? (
          <XCircle className="text-destructive size-6 shrink-0" aria-hidden />
        ) : (
          <Clock className="text-warning size-6 shrink-0" aria-hidden />
        )}
        <div>
          <p className={isCancel ? 'text-destructive font-semibold' : 'text-warning font-semibold'}>
            {view.terminalLabel}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">{view.terminalDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {TIMELINE_STEPS.map((step, idx) => {
        const done = idx < view.activeIndex;
        const active = idx === view.activeIndex;
        const last = idx === TIMELINE_STEPS.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={[
                  'flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                  done || active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground',
                ].join(' ')}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : idx + 1}
              </span>
              {!last && (
                <span
                  className={['w-0.5 flex-1', idx < view.activeIndex ? 'bg-primary' : 'bg-input'].join(
                    ' ',
                  )}
                  style={{ minHeight: '1.5rem' }}
                  aria-hidden
                />
              )}
            </div>
            <div className={last ? 'pb-0 pt-1' : 'pb-6 pt-1'}>
              <p className={active ? 'font-bold' : done ? 'font-medium' : 'text-muted-foreground'}>
                {step.label}
              </p>
              {active && <p className="text-muted-foreground mt-0.5 text-sm">{step.desc}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
