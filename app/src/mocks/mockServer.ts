/**
 * 서버 연동 전, 로딩·오류 화면을 확인하기 위한 임시 요청 함수.
 * 임시 데이터를 조금 늦게 돌려줘서 로딩 화면이 보이게 하고,
 * MOCK_SCENARIO를 바꾸면 실패 상황도 만들 수 있습니다.
 *
 * TODO(한정혁): 통신 계층(src/api/)이 생기면 이 파일의 함수들을 실제 API 호출로 바꿔 주세요.
 */
import { MOCK_MANAGER_ACCOUNTS } from '@/mocks/managers';
import { applyMockAction, applyMockFaultReport, type VehicleAction } from '@/mocks/vehicleActions';
import { findMockVehicle, MOCK_VEHICLES } from '@/mocks/vehicles';
import type { Manager } from '@/types/manager';
import type { Vehicle } from '@/types/vehicle';

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

function respond<T>(make: () => T, delay: number, fail: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (fail) return reject(new MockNetworkError());
      try {
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

/** 제어 요청 (일시정지·재개·취소·전원·고장 해제). 성공하면 바뀐 차량 상태를 돌려줍니다. */
export function sendMockAction(vehicle: Vehicle, action: VehicleAction): Promise<Vehicle> {
  return respond(() => applyMockAction(vehicle, action), ACTION_DELAY_MS, MOCK_SCENARIO === 'action-error');
}

/** 고장 신고. 성공하면 바뀐 차량 상태를 돌려줍니다. */
export function sendMockFaultReport(vehicle: Vehicle, reason: string | null): Promise<Vehicle> {
  return respond(() => applyMockFaultReport(vehicle, reason), ACTION_DELAY_MS, MOCK_SCENARIO === 'action-error');
}
