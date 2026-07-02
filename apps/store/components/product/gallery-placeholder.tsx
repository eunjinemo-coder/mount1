import type { ReactElement } from 'react';
import type { GallerySceneKey } from '@/lib/dummy-products';

/**
 * 시공 사진 자리 SVG 플레이스홀더.
 * TODO(실자료): 실 시공 사진 수령 시 이 컴포넌트 대신 next/image <Image>로 교체.
 *   gallery 데이터의 scene 키를 photo URL 로 바꾸고 ConstructionGallery 에서 렌더러만 교체하면 된다.
 *
 * 장면(scene)별로 벽면·TV·환경 실루엣을 달리 그려 4~6장이 서로 다른 현장처럼 보이게 한다.
 * 순수 표현용이므로 aria-hidden — 의미(캡션)는 상위 figure/figcaption 이 전달.
 */

const SCENE_FILLS: Record<GallerySceneKey, { from: string; to: string; floor: string }> = {
  living: { from: '#eff6ff', to: '#dbeafe', floor: '#cbd5e1' },
  bedroom: { from: '#f1f5f9', to: '#e2e8f0', floor: '#cbd5e1' },
  commercial: { from: '#e0e7ff', to: '#c7d2fe', floor: '#94a3b8' },
  detail: { from: '#dbeafe', to: '#bfdbfe', floor: '#93c5fd' },
};

interface Props {
  scene: GallerySceneKey;
}

export function GalleryPlaceholder({ scene }: Props): ReactElement {
  const c = SCENE_FILLS[scene];
  const gradientId = `gallery-${scene}`;

  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${gradientId})`} />

      {/* 바닥선 */}
      <rect x="0" y="248" width="400" height="52" fill={c.floor} opacity="0.5" />

      {scene === 'detail' ? (
        <DetailScene />
      ) : (
        <RoomScene scene={scene} />
      )}
    </svg>
  );
}

function RoomScene({ scene }: { scene: GallerySceneKey }): ReactElement {
  // 벽걸이 TV 실루엣 + 환경 소품
  return (
    <g>
      <rect x="120" y="70" width="160" height="96" rx="6" fill="#1e293b" opacity="0.92" />
      <rect x="128" y="78" width="144" height="80" rx="2" fill="#0f172a" />
      {/* 무타공 브라켓 연결부 */}
      <g stroke="#2563eb" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M200 166 L200 196" />
        <path d="M170 182 L230 182" />
      </g>
      <circle cx="170" cy="196" r="5" fill="#2563eb" />
      <circle cx="230" cy="196" r="5" fill="#2563eb" />

      {scene === 'living' && (
        <>
          {/* 소파 */}
          <rect x="96" y="214" width="208" height="34" rx="10" fill="#94a3b8" opacity="0.6" />
          <rect x="300" y="196" width="26" height="52" rx="6" fill="#64748b" opacity="0.5" />
        </>
      )}
      {scene === 'bedroom' && (
        <>
          {/* 침대 헤드 */}
          <rect x="112" y="220" width="176" height="28" rx="8" fill="#94a3b8" opacity="0.55" />
          <rect x="70" y="200" width="20" height="48" rx="5" fill="#64748b" opacity="0.45" />
        </>
      )}
      {scene === 'commercial' && (
        <>
          {/* 옆 패널 (다중 설치 암시) */}
          <rect x="300" y="86" width="72" height="64" rx="4" fill="#1e293b" opacity="0.55" />
          <rect x="28" y="86" width="72" height="64" rx="4" fill="#1e293b" opacity="0.55" />
        </>
      )}
    </g>
  );
}

function DetailScene(): ReactElement {
  // 압착 유닛 클로즈업
  return (
    <g>
      <rect x="60" y="60" width="280" height="150" rx="12" fill="#ffffff" opacity="0.7" />
      {/* 브라켓 암 */}
      <rect x="120" y="120" width="160" height="16" rx="8" fill="#2563eb" />
      <rect x="192" y="70" width="16" height="120" rx="8" fill="#1d4ed8" />
      {/* 압착 볼트 4점 */}
      <circle cx="140" cy="128" r="14" fill="#1e3a8a" />
      <circle cx="260" cy="128" r="14" fill="#1e3a8a" />
      <circle cx="200" cy="82" r="12" fill="#1e3a8a" />
      <circle cx="200" cy="178" r="12" fill="#1e3a8a" />
      <circle cx="140" cy="128" r="5" fill="#93c5fd" />
      <circle cx="260" cy="128" r="5" fill="#93c5fd" />
    </g>
  );
}
