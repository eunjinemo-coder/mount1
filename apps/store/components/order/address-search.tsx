'use client';

import { Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

/**
 * 다음(카카오) 우편번호 서비스 — 무료·키 불요.
 * 스크립트는 "주소 검색" 클릭 시점에만 동적 삽입(초기 로드 부담 0).
 * 선택 시 우편번호·기본주소를 부모로 전달 → 부모가 채우고 상세주소로 포커스.
 * 로드/초기화 실패 시 onError 로 알려 수기 입력 폴백을 열어준다.
 */

const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const SCRIPT_MARKER = 'data-daum-postcode';

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
}

interface DaumPostcodeInstance {
  embed: (el: HTMLElement, opts?: { autoClose?: boolean }) => void;
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void;
  onclose?: () => void;
  width?: string | number;
  height?: string | number;
}

interface DaumNamespace {
  Postcode: new (opts: DaumPostcodeOptions) => DaumPostcodeInstance;
}

declare global {
  interface Window {
    daum?: DaumNamespace;
  }
}

/** 스크립트를 1회만 로드(중복 삽입 방지). */
function loadPostcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('no window'));
      return;
    }
    if (window.daum?.Postcode) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('load error')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute(SCRIPT_MARKER, 'true');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('load error')), { once: true });
    document.body.appendChild(script);
  });
}

interface Props {
  onSelected: (value: { postcode: string; address: string }) => void;
  onError?: () => void;
}

export function AddressSearch({ onSelected, onError }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // 모달을 연 트리거 요소 — 닫힐 때 이 요소로 포커스 복원.
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // 최신 콜백을 ref 로 참조 — 임베드 effect 의존성을 [open] 으로 좁혀 재임베드 방지.
  const onSelectedRef = useRef(onSelected);
  onSelectedRef.current = onSelected;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const handleOpen = async (): Promise<void> => {
    if (loading || open) return;
    // 복원 대상(트리거)을 열기 직전에 저장.
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    setLoading(true);
    try {
      await loadPostcodeScript();
      setOpen(true);
    } catch {
      onErrorRef.current?.();
    } finally {
      setLoading(false);
    }
  };

  // 열림 시 패널로 초기 포커스, 닫힘 시 트리거로 포커스 복원.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
      return;
    }
    const prev = previousActiveRef.current;
    if (prev && typeof prev.focus === 'function') prev.focus();
  }, [open]);

  // Escape 로 닫기 + 간단한 focus-trap(모달 내부 chrome 순환).
  // 다음 임베드는 교차 출처 iframe 이라 그 내부 Tab 은 브라우저가 처리(한계).
  const onModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // 오버레이 마운트 후 임베드 — 컨테이너 ref 확보 시점 보장.
  useEffect(() => {
    if (!open) return;
    const el = embedRef.current;
    if (!el || !window.daum?.Postcode) {
      setOpen(false);
      onErrorRef.current?.();
      return;
    }
    el.replaceChildren();
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.userSelectedType === 'J' ? data.jibunAddress : data.roadAddress;
        onSelectedRef.current({ postcode: data.zonecode, address });
        setOpen(false);
      },
      onclose: () => setOpen(false),
      width: '100%',
      height: '100%',
    }).embed(el, { autoClose: false });
  }, [open]);

  // 모달 열림 중 body 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="border-input hover:bg-accent flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <MapPin className="size-4" aria-hidden />
        )}
        주소 검색
      </button>

      {open && (
        <div
          className="bg-foreground/20 fixed inset-0 z-modal flex items-center justify-center p-4"
          onKeyDown={onModalKeyDown}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="주소 검색"
            tabIndex={-1}
            className="border-border bg-background shadow-4 flex h-[520px] max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border outline-none"
          >
            <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">주소 검색</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-xl"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div ref={embedRef} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </>
  );
}
