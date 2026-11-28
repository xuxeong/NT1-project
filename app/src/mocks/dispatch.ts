import { C_TRACK_CENTER } from '@/constants/map';
import type { DispatchPreview } from '@/types/dispatch';
import type { LatLng } from '@/types/vehicle';
import { haversineMeters, pathLength } from '@/utils/geo';

/**
 * [임시] 배차 경로 미리보기·확정 경로 흉내.
 * 실제 서버는 도로망(server/app/simulator/road_network.py)으로 목적지를 도로 위에 맞추고 최단 경로를 찾지만,
 * 앱에는 도로망이 없어서 차량 → 목적지를 'ㄱ'자로 잇는 간단한 경로를 만듭니다. 도로 보정은 하지 않습니다(0m).
 *
 * TODO(한정혁): 연동 시 POST /api/dispatch/preview, GET /api/dispatch/{vehicle_id}/route 응답으로 바꿔 주세요.
 */

/** C-Track 기준점에서 이보다 멀면 도로망 밖이라 경로를 찾을 수 없다고 봅니다 (서버 422 흉내) */
const ROAD_NETWORK_RADIUS_M = 1500;

export class MockRouteNotFoundError extends Error {
  constructor() {
    super('경로를 찾을 수 없음');
    this.name = 'MockRouteNotFoundError';
  }
}

/** 차량 위치 → 목적지 경로 미리보기. 도로망 밖이면 MockRouteNotFoundError */
export function makeMockPreview(from: LatLng, to: LatLng): DispatchPreview {
  if (haversineMeters(C_TRACK_CENTER, to) > ROAD_NETWORK_RADIUS_M) throw new MockRouteNotFoundError();
  // 세로로 먼저 가고 가로로 가는 'ㄱ'자 경로
  const path = [from, { lat: to.lat, lng: from.lng }, to];
  return { target: to, snapDistanceM: 0, distanceM: Math.round(pathLength(path)), path };
}

/** 진행 중인 작업의 확정 경로 (차량 ID → 경로). 화면 확인용으로 2호차 작업 경로를 넣어 둡니다. */
export const MOCK_ROUTES = new Map<string, LatLng[]>([
  [
    'X3S1182',
    [
      { lat: 36.729597, lng: 127.4395988 },
      { lat: 36.7282, lng: 127.4395988 },
      { lat: 36.7282, lng: 127.4421 },
    ],
  ],
]);
