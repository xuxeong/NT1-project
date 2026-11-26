import { MOCK_BASE_URL } from '@/constants/server';
import type { LatLng } from '@/types/vehicle';

/** C-Track 기준점 */
export const C_TRACK_CENTER: LatLng = { lat: 36.727629, lng: 127.440838 };

/**
 * 지도 배경 타일 주소 (Mock 서버의 OSM 타일 중계 API).
 * 앱이 OSM 공식 타일 서버에 직접 요청하면 앱 정보 헤더(User-Agent)가 없어 차단되므로,
 * 서버가 대신 받아서 저장해 두고 돌려주는 GET /tiles/{z}/{x}/{y}.png를 씁니다 (server/app/main.py).
 * 서버가 꺼져 있으면 타일이 비어서 아래의 기본 지도만 보입니다.
 */
export const MAP_TILE_URL: string | null = `${MOCK_BASE_URL}/tiles/{z}/{x}/{y}.png`;
export const MAP_TILE_MAX_ZOOM = 19;
/** OSM 타일을 쓸 때 화면에 꼭 남겨야 하는 출처 표시 */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';

/** C-Track 전체가 보이는 기본 확대 범위 */
export const C_TRACK_REGION = {
  latitude: C_TRACK_CENTER.lat,
  longitude: C_TRACK_CENTER.lng,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};
