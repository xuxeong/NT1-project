import { C_TRACK_CENTER } from '@/constants/map';
import type { LatLng } from '@/types/vehicle';

const EARTH_RADIUS_M = 6_371_000;

/** C-Track 기준점에서 이 거리보다 멀면 "C-Track 밖"으로 봅니다. */
const C_TRACK_RADIUS_M = 2_000;

/** 두 좌표 사이의 직선 거리(m). 서버와 같은 Haversine 공식을 씁니다. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * 거리 계산의 기준점 (연동 가이드 4.1).
 * 사용자가 C-Track 안에 있으면 사용자 위치, 밖에 있거나 위치를 모르면 C-Track 기준점을 씁니다.
 * (학교·집에서 테스트할 때 수백 km가 표시되지 않게 하기 위함)
 */
export function distanceReference(user: LatLng | null): LatLng {
  if (user && haversineMeters(user, C_TRACK_CENTER) <= C_TRACK_RADIUS_M) return user;
  return C_TRACK_CENTER;
}

/** 1km 미만은 "420 m", 그 이상은 "117.2 km" 형식으로 표시합니다. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** 경로(점 목록) 전체 길이(m) */
export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineMeters(path[i - 1], path[i]);
  return total;
}

/** 앱 좌표(lat/lng) → 지도 좌표(latitude/longitude). Polyline·Marker에 넘길 때 씁니다 */
export function toMapCoords(path: LatLng[]) {
  return path.map((p) => ({ latitude: p.lat, longitude: p.lng }));
}

/**
 * 경로 전체가 보이는 지도 범위 (animateToRegion에 넘김).
 * fitToCoordinates의 여백은 Android에서 단위가 기기마다 달라 보이는 문제가 있어 범위를 직접 계산합니다.
 * 위쪽에는 안내 문구·핀 말풍선이 있어서 경로가 화면 가운데보다 조금 아래에 오도록 위쪽 여백을 더 줍니다.
 */
export function regionAround(path: LatLng[]) {
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const latitudeDelta = Math.max(0.002, (maxLat - minLat) * 2.2);
  const longitudeDelta = Math.max(0.002, (maxLng - minLng) * 1.6);
  return {
    latitude: (minLat + maxLat) / 2 + latitudeDelta * 0.1,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
