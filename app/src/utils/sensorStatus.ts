import type { Vehicle } from '@/types/vehicle';

/** 센서 한 줄의 상태: 정상 / 주의 / 이상 */
export type SensorLevel = 'ok' | 'warn' | 'error';

export type SensorItem = {
  key: string;
  /** 한글 이름 (영문 약어) */
  name: string;
  /** 하는 일 */
  description: string;
  /** 설명 뒤에 붙는 현재 값 (예: GNSS 'RTK FIX'). 수신 없음일 때는 숨깁니다 */
  detail?: string;
} &({ kind: 'level'; level: SensorLevel } | { kind: 'value'; value: string });

/**
 * GNSS 위치 고정 상태 판정 (팀 결정 11/27)
 * - RTK FIX → 정상 (오차 약 1~3cm)
 * - RTK FLOAT → 주의 (보정 계산이 아직 덜 맞음, 오차 수십 cm)
 * - 그 외 (DGPS, 단독 측위, No Fix 등) → 이상
 */
export function gnssLevel(fix: string): SensorLevel {
  const normalized = fix.trim().toUpperCase();
  if (normalized === 'RTK FIX') return 'ok';
  if (normalized === 'RTK FLOAT') return 'warn';
  return 'error';
}

/**
 * 센서 값을 믿을 수 있는지 (서버의 sensors_available과 같은 규칙).
 * 전원이 꺼졌거나(driveMode 0) 오프라인(powerState false)이면 센서 값을 표시하지 않습니다.
 */
export function isSensorDataAvailable(v: Vehicle): boolean {
  return v.driveMode === 1 && v.powerState;
}

/** 센서 상태 시트에 보여 줄 항목 (Figma: 차량 상세 화면 · 센서 상태) */
export function getSensorItems(v: Vehicle): SensorItem[] {
  const s = v.sensors;
  const ok = (good: boolean): SensorLevel => (good ? 'ok' : 'error');
  return [
    { key: 'lidar', name: '라이다 (LiDAR)', description: '주변 물체까지의 거리 감지', kind: 'level', level: ok(s.lidar_ok) },
    { key: 'radar', name: '레이더 (Radar)', description: '움직이는 물체의 속도 감지', kind: 'level', level: ok(s.radar_ok) },
    { key: 'camera', name: '카메라', description: '차선·신호·보행자 인식', kind: 'level', level: ok(s.camera_ok) },
    { key: 'imu', name: '관성 센서 (IMU)', description: '차량 기울기·회전 감지', kind: 'level', level: ok(s.imu_ok) },
    {
      key: 'gnss',
      name: '위치 측정 (GNSS)',
      description: '위성으로 현재 위치 확인',
      detail: s.gnss_fix,
      kind: 'level',
      level: gnssLevel(s.gnss_fix),
    },
    // 온도는 정상 기준이 없어 숫자만 보여 줍니다.
    { key: 'temperature', name: '시스템 온도', description: '차량 컴퓨터 온도', kind: 'value', value: `${s.temperature_c.toFixed(1)}℃` },
  ];
}
