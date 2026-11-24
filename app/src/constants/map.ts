import type { LatLng } from '@/types/vehicle';

/** C-Track 기준점 (NT1 11/16 피드백의 OSM 링크 좌표) */
export const C_TRACK_CENTER: LatLng = { lat: 36.727629, lng: 127.440838 };

/**
 * 지도 배경 타일 주소. 지금은 비어 있어서 지도가 회색 배경으로만 보입니다.
 *
 * [TODO: 한정혁 · 서버팀] 앱이 OSM 공식 타일 서버(tile.openstreetmap.org)에 직접 요청하면
 * 앱 정보 헤더(User-Agent)가 없어 차단 이미지가 옵니다. react-native-maps는 이 헤더를 바꿀 수 없습니다.
 * Mock 서버에 타일 중계 API(예: GET /tiles/{z}/{x}/{y}.png)가 생기면 아래처럼 넣어 주세요.
 *   export const MAP_TILE_URL: string | null = `${MOCK_BASE_URL}/tiles/{z}/{x}/{y}.png`;
 * (서버는 앱 정보를 담은 User-Agent로 OSM에 요청하고, 받은 타일을 저장해 두고 재사용해야 합니다.)
 */
export const MAP_TILE_URL: string | null = null;
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
