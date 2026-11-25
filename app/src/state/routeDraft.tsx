/**
 * 작업 경로 설정에서 고르는 중인 경로 (작업 경로 설정 · 지점 선택 화면이 함께 씁니다).
 * 순서: 출발 1개 → 경유 0개 이상 → 도착 1개.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type StopKind = 'start' | 'stop' | 'end';

export interface RouteStop {
  key: string;
  kind: StopKind;
  stationId: string | null;
  /** 담당자 (입력 화면은 나중에 만듭니다) */
  contact: string | null;
}

interface RouteDraft {
  vin: string;
  stops: RouteStop[];
}

type Ctx = {
  draft: RouteDraft;
  /** 경로 설정을 새로 시작합니다. 출발지는 차량의 현재 위치에 가장 가까운 지점입니다. */
  reset: (vin: string, startStationId: string | null) => void;
  setStation: (key: string, stationId: string) => void;
  addStop: () => void;
  /** 경유지는 줄을 지우고, 도착지는 고른 지점만 비웁니다. */
  removeStop: (key: string) => void;
};

let seq = 0;
const newKey = () => `stop-${++seq}`;

const RouteDraftContext = createContext<Ctx | null>(null);

export function RouteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RouteDraft>({ vin: '', stops: [] });

  const reset = useCallback((vin: string, startStationId: string | null) => {
    setDraft({
      vin,
      stops: [
        { key: newKey(), kind: 'start', stationId: startStationId, contact: null },
        { key: newKey(), kind: 'end', stationId: null, contact: null },
      ],
    });
  }, []);

  const setStation = useCallback((key: string, stationId: string) => {
    setDraft((d) => ({ ...d, stops: d.stops.map((s) => (s.key === key ? { ...s, stationId } : s)) }));
  }, []);

  const addStop = useCallback(() => {
    setDraft((d) => {
      const stops = [...d.stops];
      stops.splice(stops.length - 1, 0, { key: newKey(), kind: 'stop', stationId: null, contact: null });
      return { ...d, stops };
    });
  }, []);

  const removeStop = useCallback((key: string) => {
    setDraft((d) => ({
      ...d,
      stops: d.stops.flatMap((s) => {
        if (s.key !== key) return [s];
        if (s.kind === 'stop') return [];
        if (s.kind === 'end') return [{ ...s, stationId: null }];
        return [s];
      }),
    }));
  }, []);

  const value = useMemo(() => ({ draft, reset, setStation, addStop, removeStop }), [draft, reset, setStation, addStop, removeStop]);
  return <RouteDraftContext.Provider value={value}>{children}</RouteDraftContext.Provider>;
}

export function useRouteDraft(): Ctx {
  const ctx = useContext(RouteDraftContext);
  if (!ctx) throw new Error('RouteDraftProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
