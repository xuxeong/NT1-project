/** 가상 차량 주행 속도 (km/h). 서버 시뮬레이터와 같습니다. 서버가 예상 시간을 주지 않아 남은 시간 계산에 씁니다 */
export const VEHICLE_SPEED_KMH = 15;

/** 거리(m)를 이 속도로 갈 때 걸리는 분 (올림, 최소 1분) */
export function minutesToDrive(meters: number): number {
  return Math.max(1, Math.ceil(meters / ((VEHICLE_SPEED_KMH * 1000) / 60)));
}
