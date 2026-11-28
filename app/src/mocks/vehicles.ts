import type { Vehicle } from '@/types/vehicle';

/**
 * 화면 개발용 임시 데이터.
 * 서버 연동(src/api/)이 준비되면 이 데이터 대신 서버 응답을 사용합니다.
 * 차량 ID·이름·좌표·배터리 등은 서버 시뮬레이터의 초기 차량(server/app/simulator/c_track_data.py)과 같습니다.
 * 단, 화면 확인용으로 2호차는 '작업 중' 상태로 바꿔 두었습니다 (서버 초기 상태는 대기).
 */
const okSensors = {
  lidar_ok: true,
  radar_ok: true,
  camera_ok: true,
  imu_ok: true,
  gnss_fix: 'RTK FIX',
  temperature_c: 42.5,
};

export const MOCK_VEHICLES: Vehicle[] = [
  {
    vin: 'X3S1181',
    vinId: 'Neolix 가상 자율주행 1호차',
    parkName: 'C-Track 오창',
    position: { lat: 36.7279642, lng: 127.4419241 },
    gnssHead: 0,
    speed: 0,
    gear: 'P',
    driveMode: 1,
    realBattery: 98.5,
    mile: 98.5,
    powerState: true,
    vehicleAvailable: 0,
    faultStatus: 0,
    faultReport: null,
    missionStatus: null,
    mission: null,
    operationStatus: 'active',
    serviceType: 'transport',
    latencyMs: 42,
    sensors: okSensors,
  },
  {
    vin: 'X3S1182',
    vinId: 'Neolix 가상 순찰 2호차',
    parkName: 'C-Track 오창',
    position: { lat: 36.729597, lng: 127.4395988 },
    gnssHead: 135,
    speed: 15,
    gear: 'D',
    driveMode: 1,
    realBattery: 89,
    mile: 89,
    powerState: true,
    vehicleAvailable: 1,
    faultStatus: 0,
    faultReport: null,
    missionStatus: 1,
    mission: {
      missionSubId: 1,
      startStationName: '출발 지점',
      endStationName: 'C-Track 도로 위 지점',
      routeDistanceM: 740,
      remainingDistanceM: 280,
      progressPercent: 62,
      startedAt: Date.now() - 3 * 60 * 1000, // 앱을 켜기 3분 전에 출발한 것으로
      // 이순찰이 운행시키고 알림 받을 담당자를 최총괄로 지정 → admin으로 로그인하면 도착 확인 창이 떠요
      notifyManager: { userId: 'admin', name: '최총괄 (전체 관제)', phone: '010-9999-0000' },
      dispatchedBy: { userId: 'manager2', name: '이순찰 (2호차 담당)', phone: '010-3333-4444' },
    },
    operationStatus: 'trial',
    serviceType: 'patrol',
    latencyMs: 48,
    sensors: okSensors,
  },
];

export function findMockVehicle(vin: string): Vehicle | undefined {
  return MOCK_VEHICLES.find((v) => v.vin === vin);
}
