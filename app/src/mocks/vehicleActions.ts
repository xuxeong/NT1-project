import type { Vehicle } from '@/types/vehicle';

/**
 * [임시] 서버 연동 전, 화면에서 버튼을 눌렀을 때 차량 상태가 어떻게 바뀌는지 흉내 내는 함수들.
 * 상태 변화 규칙은 docs/APP_SERVER_INTEGRATION.md 3.2를 따릅니다.
 *
 * TODO(한정혁): 서버 연동 후에는 아래 API를 호출하고, 응답으로 받은 차량 상태로 화면을 갱신해 주세요.
 *   pause      → POST /mock/vehicles/{vin}/pause
 *   resume     → POST /mock/vehicles/{vin}/resume
 *   cancel     → POST /openapi-server/slvapi/vehicleCancel?vin={vin}  (정차 상태에서만 가능)
 *   powerOn/Off→ POST /openapi-server/slvapi/powerOnOff {vin, handleType: 1 | 2}
 *   고장 신고   → POST /mock/vehicles/{vin}/fault {faultStatus: 1, reason}
 *   clearFault → POST /mock/vehicles/{vin}/fault {faultStatus: 0}
 */
export type VehicleAction = 'pause' | 'resume' | 'cancel' | 'powerOn' | 'powerOff' | 'clearFault';

export function applyMockAction(v: Vehicle, action: VehicleAction): Vehicle {
  switch (action) {
    case 'pause':
      if (v.missionStatus !== 1) return v;
      return { ...v, missionStatus: 2, speed: 0, gear: 'P' };
    case 'resume':
      if (v.missionStatus !== 2 || v.faultStatus === 1) return v;
      return { ...v, missionStatus: 1, speed: 15, gear: 'D' };
    case 'cancel':
      if (v.speed > 0) return v; // 주행 중에는 취소 불가 (먼저 일시정지)
      return withAvailability({ ...v, missionStatus: 4, speed: 0, gear: 'P' });
    case 'powerOff': {
      if (v.speed > 0) return v; // 주행 중에는 전원 끄기 불가
      const wasPaused = v.missionStatus === 2;
      return withAvailability({
        ...v,
        driveMode: 0,
        missionStatus: wasPaused ? 4 : v.missionStatus, // 일시정지 중이던 작업은 취소 처리
      });
    }
    case 'powerOn':
      return withAvailability({ ...v, driveMode: 1 });
    case 'clearFault': {
      // 신고만 지웁니다. 센서 이상이 남아 있으면 고장 상태가 유지되고, 작업은 자동으로 재개하지 않습니다 (연동 가이드 4.3).
      return withAvailability({ ...v, faultReport: null, faultStatus: hasSensorFault(v) ? 1 : 0 });
    }
  }
}

/**
 * 고장 신고 (연동 가이드 4.3).
 * 주행 중이면 즉시 일시정지하고, 해제 전까지 배차·재개를 막습니다. 다시 신고하면 사유를 바꿉니다.
 */
export function applyMockFaultReport(v: Vehicle, reason: string | null, reportedAt = Date.now()): Vehicle {
  const stop = v.missionStatus === 1 ? { missionStatus: 2 as const, speed: 0, gear: 'P' as const } : {};
  return withAvailability({ ...v, ...stop, faultStatus: 1, faultReport: { reason, reportedAt } });
}

/**
 * 배차 가능 여부(vehicleAvailable)를 상태에 맞게 다시 계산합니다 (서버 dispatch_available과 같은 규칙).
 * 전원 ON + 온라인 + 고장 없음 + 운행 정지(suspended) 아님 + 정차 + 진행 중인 작업 없음이면 배차 가능(0)입니다.
 * 작업을 취소하거나 끝나도 고장이 남아 있으면 배차할 수 없습니다.
 */
function withAvailability(v: Vehicle): Vehicle {
  const available =
    v.driveMode === 1 &&
    v.powerState &&
    v.faultStatus === 0 &&
    v.operationStatus !== 'suspended' &&
    v.speed === 0 &&
    v.missionStatus !== 1 &&
    v.missionStatus !== 2;
  return { ...v, vehicleAvailable: available ? 0 : 1 };
}

/** LiDAR·Radar·Camera·IMU 중 하나라도 이상이면 고장 (서버 has_fault와 같은 규칙) */
function hasSensorFault(v: Vehicle): boolean {
  const s = v.sensors;
  return !(s.lidar_ok && s.radar_ok && s.camera_ok && s.imu_ok);
}
