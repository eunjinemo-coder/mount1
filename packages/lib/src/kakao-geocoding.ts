export interface GeocodingResult {
  lat: number;
  lng: number;
  /** API-provided road address (도로명) */
  roadAddress?: string;
  /** API-provided land lot address (지번) */
  landAddress?: string;
}

/**
 * Resolve a Korean address string to lat/lng using Kakao Local API.
 * Returns null if no result, throws if API key missing or HTTP error.
 *
 * Must only be called from server-side code (admin server actions).
 * Do NOT call from client components.
 *
 * @example
 *   const r = await geocodeAddress('서울 강남구 테헤란로 152');
 *   // → { lat: 37.5..., lng: 127.0..., roadAddress: '...', landAddress: '...' }
 */
export async function geocodeAddress(
  addressFull: string,
): Promise<GeocodingResult | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error('KAKAO_REST_API_KEY env var missing');
  }

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addressFull)}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Kakao geocoding HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    documents: {
      x: string;
      y: string;
      road_address: { address_name: string } | null;
      address: { address_name: string } | null;
    }[];
  };

  if (!Array.isArray(body?.documents)) return null;

  const first = body.documents[0];
  if (first === undefined) {
    return null;
  }

  const lat = Number(first.y);
  const lng = Number(first.x);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null; // malformed coordinate from Kakao API
  }

  return {
    lat,
    lng,
    roadAddress: first.road_address?.address_name,
    landAddress: first.address?.address_name,
  };
}
