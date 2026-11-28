/** 알림을 보낸 사람 (고장 신고한 사람 / 차량을 운행시킨 사람) */
export interface NotificationSender {
  userId: string;
  name: string;
  phone: string;
}

/**
 * 담당자 알림 (메시지 탭). 받는 사람마다 한 줄씩 있습니다.
 * 서버 GET /api/managers/notifications?user_id= 응답 한 줄을 앱에서 쓰기 쉬운 이름으로 옮긴 타입입니다.
 *   user_id → recipientUserId, vehicle_id → vehicleId, trigger_type → type, created_at → createdAt(ms)
 *
 * 알림 규칙 (NT1 회의 결정)
 * - faultReport(고장 신고): 그 차량 담당자 모두에게. 보낸 사람 = 신고한 사람
 * - departed(출발) · arrived(도착): 그 운행의 '알림 받을 담당자'에게만. 보낸 사람 = 차량을 운행시킨 사람
 *
 * TODO(서버팀 요청): 지금 서버에는 출발(DEPARTED) 알림과 보낸 사람(sender) 정보가 없고,
 * 출발·도착 알림도 차량 담당자 모두에게 보내요. 위 규칙대로 바꿔 달라고 요청이 필요해요.
 */
export interface AppNotification {
  id: string;
  /** 알림을 받은 사람 (로그인 아이디) */
  recipientUserId: string;
  vehicleId: string;
  /** departed: 운행 시작 (DEPARTED, 서버 추가 필요), arrived: 목적지 도착 (ARRIVED), faultReport: 고장 신고 (FAULT_REPORT) */
  type: 'departed' | 'arrived' | 'faultReport';
  /** 보낸 사람. 알 수 없으면 null */
  sender: NotificationSender | null;
  /** 서버가 만든 알림 문구 (지금 화면에서는 쓰지 않고, 유형·차량으로 문구를 만듭니다) */
  message: string;
  /** 알림 시각 (ms) */
  createdAt: number;
}
