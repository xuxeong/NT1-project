import type { LatLng } from '@/types/vehicle';

/**
 * 배차 경로 미리보기 (서버: POST /api/dispatch/preview).
 *   target → target, snap_distance_m → snapDistanceM, distance_m → distanceM, path → path
 */
export interface DispatchPreview {
  /** 도로 위로 맞춘 목적지 */
  target: LatLng;
  /** 지도에서 찍은 위치와 도로 위 목적지 사이 거리 (m) */
  snapDistanceM: number;
  /** 차량 → 목적지 경로 거리 (m) */
  distanceM: number;
  /** 차량 → 목적지 경로 (지도 선) */
  path: LatLng[];
}

/** 배차 요청 (서버: POST /api/dispatch {vehicle_id, kind: 'point', target_lat, target_lng, target_name}) */
export interface DispatchRequest {
  target: LatLng;
  /** 비워 두면 '지도에서 선택한 목적지' */
  targetName: string;
  /**
   * 출발·도착 알림을 받을 담당자 아이디.
   * TODO(서버팀 요청): 지금 서버 배차 요청에는 이 칸이 없어요. 추가되면 함께 보내 주세요.
   */
  notifyUserId: string;
}
