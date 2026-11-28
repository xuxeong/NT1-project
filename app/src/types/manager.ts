/**
 * 담당자(관제 계정) 정보.
 * 서버 POST /api/managers/login 응답의 manager 필드를 앱에서 쓰기 쉬운 이름으로 옮긴 타입입니다.
 *   user_id → userId, assigned_aoi → assignedAoi, assigned_vehicle_ids → assignedVehicleIds
 */
export interface Manager {
  /** 로그인 아이디. 예) manager1 */
  userId: string;
  /** 표시 이름. 예) 김관제 (1호차 담당) */
  name: string;
  /** 도착·고장 알림을 받는 연락처 */
  phone: string;
  /** manager: 담당자, admin: 전체 관제 */
  role: 'manager' | 'admin';
  /** 담당 운영 구역 (AOI) */
  assignedAoi: string;
  /** 담당 차량 ID 목록. 차량 목록은 이 차량만 보여 줍니다 */
  assignedVehicleIds: string[];
}
