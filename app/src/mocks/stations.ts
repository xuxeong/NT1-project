import type { LatLng } from '@/types/vehicle';

/**
 * [임시] 작업 경로 설정에서 고르는 지점 목록.
 * 서버에 고정 지점 목록이 없어서 Figma 예시 이름과 C-Track 근처 좌표로 만들었습니다.
 * TODO(한정혁·서버팀): 지점 목록 API(또는 listStationByVin)가 정해지면 서버 응답으로 바꿔 주세요.
 */
export interface Station {
  id: string;
  name: string;
  position: LatLng;
}

export const MOCK_STATIONS: Station[] = [
  { id: 'depot', name: 'C-Track 대기소', position: { lat: 36.7279642, lng: 127.4419241 } },
  { id: 'a', name: '배송 지점 A', position: { lat: 36.7286, lng: 127.441 } },
  { id: 'b', name: '배송 지점 B', position: { lat: 36.7293, lng: 127.4401 } },
  { id: 'c', name: '배송 지점 C', position: { lat: 36.7301, lng: 127.4392 } },
  { id: 'gate', name: '정문 승하차장', position: { lat: 36.7268, lng: 127.443 } },
];

export const findStation = (id: string | null) => MOCK_STATIONS.find((s) => s.id === id) ?? null;
