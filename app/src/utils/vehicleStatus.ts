import type { ChipTone } from '@/components/StatusChip';
import type { Vehicle } from '@/types/vehicle';

export type VehicleStatusKey = 'offline' | 'fault' | 'powerOff' | 'inTask' | 'paused' | 'available' | 'unavailable';

const LABELS: Record<VehicleStatusKey, { label: string; tone: ChipTone }> = {
  offline: { label: '오프라인', tone: 'danger' },
  fault: { label: '고장', tone: 'danger' },
  powerOff: { label: '전원 꺼짐', tone: 'danger' },
  inTask: { label: '작업 중', tone: 'accent' },
  paused: { label: '일시 정지', tone: 'danger' },
  available: { label: '이용 가능', tone: 'success' },
  unavailable: { label: '이용 불가', tone: 'danger' },
};

/**
 * 차량 상태를 하나로 정리합니다.
 * 우선순위: 오프라인 → 고장 → 전원 꺼짐 → 작업 상태 → 배차 가능 여부
 * (기준: docs/APP_SERVER_INTEGRATION.md 3장)
 */
export function getVehicleStatusKey(v: Vehicle): VehicleStatusKey {
  if (!v.powerState) return 'offline';
  if (v.faultStatus === 1) return 'fault';
  if (v.driveMode === 0) return 'powerOff';
  if (v.missionStatus === 1) return 'inTask';
  if (v.missionStatus === 2) return 'paused';
  if (v.vehicleAvailable === 0) return 'available';
  return 'unavailable';
}

/** 차량 상태를 화면에 보여 줄 문구와 색으로 바꿉니다. */
export function getVehicleStatus(v: Vehicle): { label: string; tone: ChipTone } {
  return LABELS[getVehicleStatusKey(v)];
}
