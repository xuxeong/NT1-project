/**
 * 서버 연동 전, 로딩·오류 화면을 확인하기 위한 임시 요청 함수.
 * 임시 데이터를 조금 늦게 돌려줘서 로딩 화면이 보이게 하고,
 * MOCK_SCENARIO를 바꾸면 실패 상황도 만들 수 있습니다.
 *
 * TODO(한정혁): 통신 계층(src/api/)이 생기면 이 파일의 함수들을 실제 API 호출로 바꿔 주세요.
 */
import { makeMockPreview, MOCK_ROUTES } from '@/mocks/dispatch';
// 화면은 이 파일에서만 가져가도록 다시 내보냅니다 (경로를 찾을 수 없음 = 서버 422)
export { MockRouteNotFoundError } from '@/mocks/dispatch';
import { MOCK_MANAGER_ACCOUNTS } from '@/mocks/managers';
import { advanceMockDriving } from '@/mocks/driving';
import { makeMockNotification, MOCK_NOTIFICATIONS, mockSender, vehicleManagerIds } from '@/mocks/notifications';
import { applyMockAction, applyMockFaultReport, type VehicleAction } from '@/mocks/vehicleActions';
import { findMockVehicle, MOCK_VEHICLES } from '@/mocks/vehicles';
import type { DispatchPreview, DispatchRequest } from '@/types/dispatch';
import type { Manager } from '@/types/manager';
import type { AppNotification } from '@/types/notification';
import type { LatLng, Vehicle } from '@/types/vehicle';

/**
 * 확인하고 싶은 상황으로 바꿔서 저장하면 됩니다.
 * - 'success': 정상 (지연 시간만큼 로딩 후 표시)
 * - 'load-error': 로그인·차량 목록·상세를 불러오지 못함 → 오류 안내
 * - 'action-error': 화면은 정상, 버튼 요청(일시정지·재개·전원 등)만 실패 → 토스트
 */
export const MOCK_SCENARIO: 'success' | 'load-error' | 'action-error' = 'success';

/** 응답 지연 (ms). 화면 확인이 편하도록 0으로 둡니다. 로딩 화면을 보려면 예) 800, 600으로 늘리세요 */
const LOAD_DELAY_MS = 0;
const ACTION_DELAY_MS = 0;

export class MockNetworkError extends Error {
  constructor() {
    super('Mock 네트워크 오류');
    this.name = 'MockNetworkError';
  }
}

/** 아이디 또는 비밀번호가 틀림 (서버 401) */
export class MockAuthError extends Error {
  constructor() {
    super('아이디 또는 비밀번호 불일치');
    this.name = 'MockAuthError';
  }
}

/** 서버가 요청을 거절함 (409: 전원 꺼짐·고장·이미 작업 중 등) */
export class MockRejectedError extends Error {
  constructor() {
    super('요청 거절');
    this.name = 'MockRejectedError';
  }
}

function respond<T>(make: () => T, delay: number, fail: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (fail) return reject(new MockNetworkError());
      try {
        // 서버처럼 시간이 흐르면 주행 중인 차량이 움직이고 도착합니다 (mocks/driving.ts)
        advanceMockDriving();
        resolve(make());
      } catch (e) {
        reject(e);
      }
    }, delay);
  });
}

/**
 * 담당자 로그인 (서버: POST /api/managers/login {user_id, password}).
 * 아이디·비밀번호가 틀리면 MockAuthError, 서버에 연결되지 않으면 MockNetworkError를 던집니다.
 */
export function mockLogin(userId: string, password: string): Promise<Manager> {
  return respond(
    () => {
      const account = MOCK_MANAGER_ACCOUNTS.find((a) => a.userId === userId.trim() && a.password === password);
      if (!account) throw new MockAuthError();
      const { password: _password, ...manager } = account;
      return manager;
    },
    LOAD_DELAY_MS,
    MOCK_SCENARIO === 'load-error',
  );
}

/**
 * 차량 목록 조회 (서버: GET /api/vehicles?user_id=...).
 * 담당 차량 ID 목록을 넘기면 그 차량만 돌려줍니다.
 */
export function fetchMockVehicles(vehicleIds?: string[]): Promise<Vehicle[]> {
  return respond(
    () => (vehicleIds ? MOCK_VEHICLES.filter((v) => vehicleIds.includes(v.vin)) : MOCK_VEHICLES),
    LOAD_DELAY_MS,
    MOCK_SCENARIO === 'load-error',
  );
}

/** 차량 상세 조회. 없는 차량이면 undefined */
export function fetchMockVehicle(vin: string | undefined): Promise<Vehicle | undefined> {
  return respond(() => (vin ? findMockVehicle(vin) : undefined), LOAD_DELAY_MS, MOCK_SCENARIO === 'load-error');
}

/**
 * 바뀐 차량 상태를 임시 데이터에 저장합니다.
 * 서버처럼 다른 화면(차량 목록·목적지 선택)에서 다시 조회해도 같은 상태가 보이게 하기 위함입니다.
 */
function saveMockVehicle(next: Vehicle): Vehicle {
  const i = MOCK_VEHICLES.findIndex((v) => v.vin === next.vin);
  if (i >= 0) MOCK_VEHICLES[i] = next;
  return next;
}

/** 제어 요청 (일시정지·재개·취소·전원·고장 해제). 성공하면 바뀐 차량 상태를 돌려줍니다. */
export function sendMockAction(vehicle: Vehicle, action: VehicleAction): Promise<Vehicle> {
  return respond(
    () => saveMockVehicle(applyMockAction(findMockVehicle(vehicle.vin) ?? vehicle, action)),
    ACTION_DELAY_MS,
    MOCK_SCENARIO === 'action-error',
  );
}

/**
 * 고장 신고. 성공하면 바뀐 차량 상태를 돌려줍니다.
 * 그 차량 담당자 모두에게 고장 신고 알림(FAULT_REPORT)을 남깁니다. 보낸 사람 = 신고한 사람(reporterUserId).
 * TODO(서버팀 요청): 서버 신고 요청에는 아직 신고한 사람 칸이 없어요.
 */
export function sendMockFaultReport(vehicle: Vehicle, reason: string | null, reporterUserId: string): Promise<Vehicle> {
  return respond(
    () => {
      const next = saveMockVehicle(applyMockFaultReport(findMockVehicle(vehicle.vin) ?? vehicle, reason));
      for (const id of vehicleManagerIds(vehicle.vin)) {
        MOCK_NOTIFICATIONS.push(makeMockNotification(vehicle.vin, 'faultReport', id, reporterUserId));
      }
      return next;
    },
    ACTION_DELAY_MS,
    MOCK_SCENARIO === 'action-error',
  );
}

/** 내가 받은 알림 조회 (서버: GET /api/managers/notifications?user_id=...). 최신순 */
export function fetchMockNotifications(userId: string): Promise<AppNotification[]> {
  return respond(
    () => MOCK_NOTIFICATIONS.filter((n) => n.recipientUserId === userId).sort((a, b) => b.createdAt - a.createdAt),
    LOAD_DELAY_MS,
    MOCK_SCENARIO === 'load-error',
  );
}

/** 차량 담당자 목록 (목적지 선택 · 알림 받을 담당자). 그 차량을 담당 차량으로 가진 계정만 돌려줍니다. */
export function fetchMockVehicleManagers(vin: string): Promise<Manager[]> {
  return respond(
    () =>
      MOCK_MANAGER_ACCOUNTS.filter((a) => a.assignedVehicleIds.includes(vin)).map(
        ({ password: _password, ...manager }) => manager,
      ),
    LOAD_DELAY_MS,
    MOCK_SCENARIO === 'load-error',
  );
}

/**
 * 배차 경로 미리보기 (서버: POST /api/dispatch/preview).
 * 도로망 밖을 찍으면 MockRouteNotFoundError(서버 422), 연결 실패는 MockNetworkError를 던집니다.
 */
export function previewMockDispatch(vehicle: Vehicle, target: LatLng): Promise<DispatchPreview> {
  return respond(
    () => makeMockPreview(vehicle.position, target),
    ACTION_DELAY_MS,
    MOCK_SCENARIO === 'action-error',
  );
}

let nextMissionId = 100;

/**
 * 배차 (서버: POST /api/dispatch). 성공하면 주행을 시작한 차량 상태를 돌려줍니다.
 * 알림 받을 담당자(notifyUserId)에게 출발 알림을 남깁니다. 보낸 사람 = 운행시킨 사람(dispatcherUserId).
 * TODO(서버팀 요청): 알림 받을 담당자·운행시킨 사람·출발 알림은 서버에 아직 없어 앱 임시 데이터에만 저장합니다.
 */
export function sendMockDispatch(vehicle: Vehicle, request: DispatchRequest, dispatcherUserId: string): Promise<Vehicle> {
  return respond(
    () => {
      // 서버 dispatch_available과 같은 규칙으로 배차할 수 없으면 거절 (409)
      const current = findMockVehicle(vehicle.vin) ?? vehicle;
      if (current.vehicleAvailable !== 0) throw new MockRejectedError();
      const preview = makeMockPreview(current.position, request.target);
      MOCK_ROUTES.set(vehicle.vin, preview.path);
      MOCK_NOTIFICATIONS.push(makeMockNotification(vehicle.vin, 'departed', request.notifyUserId, dispatcherUserId));
      return saveMockVehicle({
        ...current,
        missionStatus: 1,
        speed: 15,
        gear: 'D',
        vehicleAvailable: 1,
        mission: {
          missionSubId: nextMissionId++,
          startStationName: '출발 위치',
          endStationName: request.targetName.trim() || '지도에서 선택한 목적지',
          routeDistanceM: preview.distanceM,
          remainingDistanceM: preview.distanceM,
          progressPercent: 0,
          startedAt: Date.now(),
          notifyManager: mockSender(request.notifyUserId),
          dispatchedBy: mockSender(dispatcherUserId),
        },
      });
    },
    ACTION_DELAY_MS,
    MOCK_SCENARIO === 'action-error',
  );
}

/** 진행 중인 작업의 확정 경로 (서버: GET /api/dispatch/{vehicle_id}/route). 작업이 없으면 빈 배열 */
export function fetchMockRoute(vin: string): Promise<LatLng[]> {
  return respond(() => MOCK_ROUTES.get(vin) ?? [], LOAD_DELAY_MS, MOCK_SCENARIO === 'load-error');
}
