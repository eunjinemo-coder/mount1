'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

/**
 * Kakao Maps JavaScript SDK 통합 — 'use client' 컴포넌트.
 *
 * 사전 조건:
 *   - .env.local 에 NEXT_PUBLIC_KAKAO_MAP_KEY 설정
 *   - Kakao Developers 콘솔에 dev/prod 도메인 등록
 *
 * 사용:
 *   <KakaoMap center={{ lat: 37.5172, lng: 127.0473 }} markers={[...]} height={320} />
 *
 * SDK 미로드 환경 (key 없음 / 도메인 차단) 에서는 fallback UI 표시 — 빌드 안전.
 */

export interface KakaoMapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  /** 1, 2, 3, ... 시퀀스 라벨 */
  rank?: number;
  variant?: 'default' | 'highlight' | 'warning';
}

export interface KakaoMapProps {
  center: { lat: number; lng: number };
  markers?: KakaoMapMarker[];
  level?: number;
  height?: number;
  className?: string;
}

interface KakaoMarkerInstance {
  setMap(map: unknown | null): void;
}

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        Map: new (container: HTMLElement, options: unknown) => unknown;
        LatLng: new (lat: number, lng: number) => unknown;
        Marker: new (options: unknown) => KakaoMarkerInstance;
        MarkerImage?: unknown;
        Size?: unknown;
      };
    };
  }
}

let scriptLoading: Promise<void> | null = null;

function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window_undefined'));
  if (window.kakao?.maps) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.kakao?.maps) {
          window.kakao.maps.load(() => resolve());
        } else {
          reject(new Error('kakao_load_failed'));
        }
      });
      return;
    }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.dataset.kakaoSdk = '1';
    script.onload = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve());
      } else {
        reject(new Error('kakao_load_failed'));
      }
    };
    script.onerror = () => reject(new Error('script_error'));
    document.head.appendChild(script);
  });

  // Reject 시 캐시 리셋 — 이후 mount 에서 재시도 가능.
  scriptLoading = promise.catch((err) => {
    scriptLoading = null;
    throw err;
  });

  return scriptLoading;
}

export function KakaoMap(props: KakaoMapProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-key'>('loading');
  const height = props.height ?? 320;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) {
      setStatus('no-key');
      return;
    }
    if (!ref.current) return;

    let cancelled = false;
    loadKakaoSdk(key)
      .then(() => {
        if (cancelled || !ref.current || !window.kakao?.maps) return;
        const map = new window.kakao.maps.Map(ref.current, {
          center: new window.kakao.maps.LatLng(props.center.lat, props.center.lng),
          level: props.level ?? 4,
        });
        // 이전 effect 의 마커 제거 후 신규 마커 attach.
        for (const prev of markersRef.current) {
          try {
            prev.setMap(null);
          } catch {
            /* noop — SDK 인스턴스 변경 시 안전 무시 */
          }
        }
        const next: KakaoMarkerInstance[] = [];
        for (const m of props.markers ?? []) {
          const marker = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(m.lat, m.lng),
            map,
            title: m.label ?? '',
          });
          next.push(marker);
        }
        markersRef.current = next;
        setStatus('ready');
      })
      .catch(() => setStatus('error'));

    return () => {
      cancelled = true;
      // unmount 시 마커 정리.
      for (const prev of markersRef.current) {
        try {
          prev.setMap(null);
        } catch {
          /* noop */
        }
      }
      markersRef.current = [];
    };
  }, [props.center.lat, props.center.lng, props.level, props.markers]);

  if (status === 'no-key') {
    return (
      <div
        className={`bg-muted text-muted-foreground flex items-center justify-center rounded-md border text-sm ${
          props.className ?? ''
        }`}
        style={{ height }}
      >
        <span>지도 키 미설정 (NEXT_PUBLIC_KAKAO_MAP_KEY)</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className={`bg-destructive/10 text-destructive flex items-center justify-center rounded-md border text-sm ${
          props.className ?? ''
        }`}
        style={{ height }}
      >
        <span>지도를 불러오지 못했어요. 도메인 등록을 확인해 주세요.</span>
      </div>
    );
  }

  return (
    <div className={`relative ${props.className ?? ''}`} style={{ height }}>
      <div ref={ref} className="size-full rounded-md border" />
      {status === 'loading' ? (
        <div className="bg-muted/60 absolute inset-0 flex items-center justify-center rounded-md text-sm">
          <span>지도 불러오는 중…</span>
        </div>
      ) : null}
    </div>
  );
}
