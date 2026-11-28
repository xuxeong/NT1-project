import { router, usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ArrivalDialog, type ArrivalInfo } from '@/components/ArrivalDialog';
import { fetchMockNotifications, fetchMockVehicle } from '@/mocks/mockServer';
import { useAuth } from '@/state/auth';
import { useToast } from '@/state/toast';
import type { AppNotification } from '@/types/notification';
import { notificationText } from '@/utils/notification';

/** 새 알림을 확인하는 주기 */
const POLL_INTERVAL_MS = 10 * 1000;

/** 메시지 탭을 마지막으로 본 시각을 계정별로 저장하는 키 */
const lastSeenKey = (userId: string) => `nt1.messages.lastSeen.${userId}`;

type NotificationsContextValue = {
  /** 내가 받은 알림 (최신순). 처음 불러오기 전이면 null */
  items: AppNotification[] | null;
  /** 처음 불러오기에 실패했는지 (이미 받은 목록이 있으면 false 유지) */
  error: boolean;
  /** 메시지 탭을 마지막으로 본 뒤에 다른 사람이 보낸 알림 수 (탭 점) */
  unreadCount: number;
  /** 지금 바로 다시 조회합니다 */
  refresh: () => Promise<void>;
  /** 지금까지 온 알림을 모두 읽음으로 표시합니다 (메시지 탭을 볼 때) */
  markAllSeen: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * 담당자 알림 (메시지 탭).
 * 로그인해 있는 동안 10초마다 서버에 새 알림이 있는지 묻고,
 * 새 알림이 오면 메시지 탭에 점을 표시하고,
 * - 도착(ARRIVED): 앱 어느 화면에서나 도착 확인 창을 띄웁니다 (여러 대면 하나씩 차례로)
 * - 출발(DEPARTED): 정보 토스트
 * - 고장 신고(FAULT_REPORT): 경고 토스트
 * 내가 직접 한 일(내가 보낸 출발·고장 신고 알림)은 목록에만 남기고 토스트·탭 점은 생략합니다.
 *
 * TODO(한정혁): 연동 시 fetchMockNotifications를 GET /api/managers/notifications?user_id=... 로 바꿔 주세요.
 * 나중에 푸시 알림이나 웹소켓을 쓰게 되면 이 파일의 주기 조회만 바꾸면 됩니다.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { manager } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();

  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  /** 띄울 도착 확인 창 (맨 앞 것부터 보여 줌) */
  const [arrivals, setArrivals] = useState<ArrivalInfo[]>([]);

  /** 이미 받은 알림 id (새 알림 구분용). null이면 아직 처음 조회 전 */
  const knownIds = useRef<Set<string> | null>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const userId = manager?.userId;

  const refresh = useCallback(
    async () => {
      if (!userId) return;
      try {
        const next = await fetchMockNotifications(userId);
        const known = knownIds.current;
        const fresh = known ? next.filter((n) => !known.has(n.id)) : [];
        knownIds.current = new Set(next.map((n) => n.id));
        setItems(next);
        setError(false);
        // 처음 조회한 목록은 점만 표시합니다 (fresh가 비어 있음).

        // 도착: 확인 창. 작업 결과(목적지 이름·출발 시각)는 그 차량의 마지막 작업 정보에서 가져옵니다.
        const arrived = fresh.filter((n) => n.type === 'arrived').reverse(); // 먼저 도착한 차량부터
        if (arrived.length > 0) {
          const infos = await Promise.all(arrived.map(toArrivalInfo));
          setArrivals((prev) => [...prev, ...infos]);
        }

        // 출발·고장 신고: 토스트. 내가 보낸 알림이거나 메시지 탭을 보고 있으면(목록에 바로 보임) 생략
        const others = fresh.filter((n) => n.type !== 'arrived' && n.sender?.userId !== userId);
        if (others.length > 0 && pathnameRef.current !== '/messages') {
          const hasFault = others.some((n) => n.type === 'faultReport');
          showToast(
            others.length === 1 ? notificationText(others[0]).title : `새 알림 ${others.length}개가 왔어요`,
            hasFault ? 'warning' : 'info',
          );
        }
      } catch {
        // 주기 조회 실패는 조용히 넘기고 다음 주기에 다시 시도합니다.
        // 아직 한 번도 받지 못했을 때만 오류 화면을 보여 줍니다.
        if (knownIds.current === null) setError(true);
      }
    },
    [userId, showToast],
  );

  // 로그인한 계정이 바뀌면 처음부터 다시 조회
  useEffect(() => {
    setItems(null);
    setError(false);
    setLastSeenAt(null);
    setArrivals([]);
    knownIds.current = null;
    if (!userId) return;

    let cancelled = false;
    SecureStore.getItemAsync(lastSeenKey(userId))
      .then((saved) => !cancelled && setLastSeenAt(saved ? Number(saved) : 0))
      .catch(() => !cancelled && setLastSeenAt(0));

    refresh();
    // 앱이 화면에 떠 있을 때만 조회합니다.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, refresh]);

  const markAllSeen = useCallback(() => {
    if (!userId || !items || items.length === 0) return;
    const newest = items[0].createdAt;
    setLastSeenAt((prev) => {
      if (prev !== null && prev >= newest) return prev;
      SecureStore.setItemAsync(lastSeenKey(userId), String(newest)).catch(() => {});
      return newest;
    });
  }, [userId, items]);

  const unreadCount = useMemo(() => {
    if (!items || lastSeenAt === null) return 0;
    return items.filter((n) => n.createdAt > lastSeenAt && n.sender?.userId !== userId).length;
  }, [items, lastSeenAt, userId]);

  const value = useMemo(
    () => ({ items, error, unreadCount, refresh, markAllSeen }),
    [items, error, unreadCount, refresh, markAllSeen],
  );
  const current = arrivals[0] ?? null;
  const closeArrival = () => setArrivals((prev) => prev.slice(1));
  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <ArrivalDialog
        arrival={current}
        onVehicleScreen={current !== null && pathname === `/vehicle/${current.vehicleId}`}
        onClose={closeArrival}
        onOpenVehicle={() => {
          if (!current) return;
          const vin = current.vehicleId;
          // Android에서는 확인 창(Modal)을 먼저 닫으면 화면 이동이 무시되어, 이동한 뒤에 창을 닫습니다.
          router.navigate({ pathname: '/vehicle/[vin]', params: { vin } });
          setTimeout(closeArrival, 300);
        }}
      />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications는 NotificationsProvider 안에서만 쓸 수 있어요.');
  return ctx;
}

/** 도착 알림 → 확인 창 내용. 차량 정보를 못 받으면 알림 시각만으로 채웁니다. */
async function toArrivalInfo(n: AppNotification): Promise<ArrivalInfo> {
  const vehicle = await fetchMockVehicle(n.vehicleId).catch(() => undefined);
  const mission = vehicle?.mission;
  return {
    vehicleId: n.vehicleId,
    targetName: mission?.endStationName ?? '지도에서 선택한 목적지',
    arrivedAt: mission?.arrivedAt ?? n.createdAt,
    startedAt: mission?.startedAt ?? null,
  };
}
