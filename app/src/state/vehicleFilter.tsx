/**
 * 차량 목록 필터 상태 (차량 목록 · 차량 필터 · 운영 구역 선택 화면이 함께 씁니다).
 *
 * - applied: 차량 목록에 실제로 적용된 필터
 * - draft:   필터 화면에서 고르는 중인 값. '필터 적용'을 누르면 applied가 됩니다.
 * 각 항목의 빈 배열은 '전체'를 뜻합니다. 같은 항목 안에서 여러 개를 고르면 그중 하나라도 맞으면 보여 줍니다.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ServiceType, Vehicle } from '@/types/vehicle';
import { getVehicleStatusKey } from '@/utils/vehicleStatus';

export type StatusFilter = 'available' | 'inTask' | 'paused' | 'powerOff' | 'fault';
export type ServiceFilter = Extract<ServiceType, 'transport' | 'patrol'>;
export type BatteryFilter = 'high' | 'low';

export interface VehicleFilter {
  /** 운영 구역(parkName). null이면 전체 */
  aoi: string | null;
  statuses: StatusFilter[];
  services: ServiceFilter[];
  batteries: BatteryFilter[];
}

export const DEFAULT_FILTER: VehicleFilter = { aoi: null, statuses: [], services: [], batteries: [] };

/** 배터리 기준 (사용자 결정 2026-11-24) */
export const BATTERY_LOW_MAX = 20; // 이하면 '배터리 부족'
export const BATTERY_HIGH_MIN = 60; // 이상이면 '60% 이상'

export function matchesFilter(v: Vehicle, f: VehicleFilter): boolean {
  if (f.aoi && v.parkName !== f.aoi) return false;
  if (f.statuses.length && !f.statuses.includes(getVehicleStatusKey(v) as StatusFilter)) return false;
  if (f.services.length && !f.services.includes(v.serviceType as ServiceFilter)) return false;
  if (f.batteries.length) {
    const ok =
      (f.batteries.includes('low') && v.realBattery <= BATTERY_LOW_MAX) ||
      (f.batteries.includes('high') && v.realBattery >= BATTERY_HIGH_MIN);
    if (!ok) return false;
  }
  return true;
}

export function isFilterActive(f: VehicleFilter): boolean {
  return f.aoi !== null || f.statuses.length > 0 || f.services.length > 0 || f.batteries.length > 0;
}

type Ctx = {
  applied: VehicleFilter;
  setApplied: (f: VehicleFilter) => void;
  draft: VehicleFilter;
  setDraft: (f: VehicleFilter | ((prev: VehicleFilter) => VehicleFilter)) => void;
};

const FilterContext = createContext<Ctx | null>(null);

export function VehicleFilterProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<VehicleFilter>(DEFAULT_FILTER);
  const [draft, setDraft] = useState<VehicleFilter>(DEFAULT_FILTER);
  const value = useMemo(() => ({ applied, setApplied, draft, setDraft }), [applied, draft]);
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useVehicleFilter(): Ctx {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('VehicleFilterProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
