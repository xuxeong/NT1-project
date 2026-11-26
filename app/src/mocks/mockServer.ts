/**
 * 서버 연동 전, 로딩·오류 화면을 확인하기 위한 임시 요청 함수.
 * 임시 데이터를 조금 늦게 돌려줘서 로딩 화면이 보이게 하고,
 * MOCK_SCENARIO를 바꾸면 실패 상황도 만들 수 있습니다.
 *
 * TODO(한정혁): 통신 계층(src/api/)이 생기면 이 파일의 함수들을 실제 API 호출로 바꿔 주세요.
 */
import { applyMockAction, type VehicleAction } from '@/mocks/vehicleActions';
import { findMockVehicle, MOCK_VEHICLES } from '@/mocks/vehicles';
import type { Vehicle } from '@/types/vehicle';

/**
 * 확인하고 싶은 상황으로 바꿔서 저장하면 됩니다.
 * - 'success': 정상 (0.8초 로딩 후 표시)
 * - 'load-error': 차량 목록·상세를 불러오지 못함 → 오류 안내 화면
 * - 'action-error': 화면은 정상, 버튼 요청(일시정지·재개·전원 등)만 실패 → 토스트
 */
export const MOCK_SCENARIO: 'success' | 'load-error' | 'action-error' = 'success';

const LOAD_DELAY_MS = 800;
const ACTION_DELAY_MS = 600;

export class MockNetworkError extends Error {
  constructor() {
    super('Mock 네트워크 오류');
    this.name = 'MockNetworkError';
  }
}

function respond<T>(make: () => T, delay: number, fail: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (fail ? reject(new MockNetworkError()) : resolve(make())), delay);
  });
}

/** 차량 목록 조회 */
export function fetchMockVehicles(): Promise<Vehicle[]> {
  return respond(() => MOCK_VEHICLES, LOAD_DELAY_MS, MOCK_SCENARIO === 'load-error');
}

/** 차량 상세 조회. 없는 차량이면 undefined */
export function fetchMockVehicle(vin: string | undefined): Promise<Vehicle | undefined> {
  return respond(() => (vin ? findMockVehicle(vin) : undefined), LOAD_DELAY_MS, MOCK_SCENARIO === 'load-error');
}

/** 제어 요청 (일시정지·재개·취소·전원). 성공하면 바뀐 차량 상태를 돌려줍니다. */
export function sendMockAction(vehicle: Vehicle, action: VehicleAction): Promise<Vehicle> {
  return respond(() => applyMockAction(vehicle, action), ACTION_DELAY_MS, MOCK_SCENARIO === 'action-error');
}
