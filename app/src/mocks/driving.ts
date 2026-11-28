import { MOCK_ROUTES } from '@/mocks/dispatch';
import { makeMockNotification, MOCK_NOTIFICATIONS, vehicleManagerIds } from '@/mocks/notifications';
import { withAvailability } from '@/mocks/vehicleActions';
import { MOCK_VEHICLES } from '@/mocks/vehicles';
import type { LatLng, Vehicle } from '@/types/vehicle';
import { haversineMeters, pathLength } from '@/utils/geo';

/**
 * [임시] 주행 흉내.
 * 서버 시뮬레이터처럼 '주행 중(missionStatus 1)'인 차량을 경로를 따라 앞으로 움직이고,
 * 끝까지 가면 도착 처리(missionStatus 3, 정차, 배차 가능)를 하고 도착 알림(ARRIVED)을 남깁니다.
 * 도착 알림은 그 운행의 알림 받을 담당자에게만 가고, 보낸 사람은 운행시킨 사람입니다.
 * 일시정지(2)·고장으로 멈춘 차량은 움직이지 않습니다.
 *
 * 앱이 임시 서버 함수(mocks/mockServer.ts)를 부를 때마다 지난 호출 이후 흐른 시간만큼 한꺼번에 움직입니다.
 * 로그인해 있으면 메시지 알림을 10초마다 조회하므로, 다른 화면에 있어도 늦어도 10초 안에 도착이 반영됩니다.
 *
 * TODO(한정혁): 연동 후에는 서버가 실제로 움직이므로 이 파일은 필요 없습니다.
 */

/**
 * 화면 확인용 빠르기 (실제 속도의 몇 배로 움직일지).
 * 서버와 같은 15km/h(초당 약 4.2m)면 300m에 약 70초가 걸려서, 시연하기 좋게 4배로 둡니다. 실제 속도로 보려면 1
 */
export const MOCK_DRIVE_SPEEDUP = 4;

let lastAdvanceAt: number | null = null;

/** 경로 시작점에서 meters만큼 간 위치 */
function pointAlong(path: LatLng[], meters: number): LatLng {
  let left = meters;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineMeters(path[i - 1], path[i]);
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      };
    }
    left -= seg;
  }
  return path[path.length - 1];
}

function arrive(v: Vehicle, now: number): Vehicle {
  const path = MOCK_ROUTES.get(v.vin);
  MOCK_ROUTES.delete(v.vin);
  // 알림 받을 담당자를 모르면(옛 데이터) 차량 담당자 모두에게 보냅니다.
  const recipients = v.mission?.notifyManager ? [v.mission.notifyManager.userId] : vehicleManagerIds(v.vin);
  for (const id of recipients) {
    MOCK_NOTIFICATIONS.push(makeMockNotification(v.vin, 'arrived', id, v.mission?.dispatchedBy?.userId, now));
  }
  return withAvailability({
    ...v,
    missionStatus: 3,
    speed: 0,
    gear: 'P',
    position: path ? path[path.length - 1] : v.position,
    mission: v.mission ? { ...v.mission, remainingDistanceM: 0, progressPercent: 100, arrivedAt: now } : null,
  });
}

/** 지난 호출 이후 흐른 시간만큼 주행 중인 차량을 움직입니다. */
export function advanceMockDriving(now = Date.now()) {
  if (lastAdvanceAt === null) {
    lastAdvanceAt = now;
    return;
  }
  const seconds = (now - lastAdvanceAt) / 1000;
  lastAdvanceAt = now;
  if (seconds <= 0) return;

  MOCK_VEHICLES.forEach((v, i) => {
    const m = v.mission;
    if (v.missionStatus !== 1 || !m) return;
    const step = (v.speed / 3.6) * MOCK_DRIVE_SPEEDUP * seconds;
    const remaining = Math.max(0, m.remainingDistanceM - step);
    if (remaining <= 0) {
      MOCK_VEHICLES[i] = arrive(v, now);
      return;
    }
    // 작업 거리와 지도 경로 길이가 다를 수 있어서(시작 데이터) 진행 비율로 위치를 정합니다.
    const ratio = m.routeDistanceM > 0 ? 1 - remaining / m.routeDistanceM : 0;
    const path = MOCK_ROUTES.get(v.vin);
    MOCK_VEHICLES[i] = {
      ...v,
      position: path && path.length > 1 ? pointAlong(path, pathLength(path) * ratio) : v.position,
      mission: { ...m, remainingDistanceM: Math.round(remaining), progressPercent: Math.round(ratio * 1000) / 10 },
    };
  });
}
