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
 */
export type VehicleAction = 'pause' | 'resume' | 'cancel' | 'powerOn' | 'powerOff';

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
      return { ...v, missionStatus: 4, speed: 0, gear: 'P', vehicleAvailable: 0 };
    case 'powerOff': {
      if (v.speed > 0) return v; // 주행 중에는 전원 끄기 불가
      const wasPaused = v.missionStatus === 2;
      return {
        ...v,
        driveMode: 0,
        vehicleAvailable: 1,
        missionStatus: wasPaused ? 4 : v.missionStatus, // 일시정지 중이던 작업은 취소 처리
      };
    }
    case 'powerOn':
      return { ...v, driveMode: 1, vehicleAvailable: v.faultStatus === 1 ? 1 : 0 };
  }
}
