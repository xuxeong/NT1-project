import { MOCK_MANAGER_ACCOUNTS } from '@/mocks/managers';
import type { AppNotification, NotificationSender } from '@/types/notification';

/**
 * [임시] 담당자 알림 목록 (서버: manager_notifications 테이블). 받는 사람마다 한 줄씩 있습니다.
 * 보내는 규칙은 types/notification.ts 참고 (고장 신고: 차량 담당자 모두, 출발·도착: 그 운행의 알림 받을 담당자).
 * 앱을 켤 때마다 지금 시각 기준으로 오늘·어제·그 전 알림이 몇 개 들어 있습니다.
 * 새 알림은 고장 신고·출발(mockServer.ts)과 도착(mocks/driving.ts) 때 추가됩니다.
 *
 * TODO(한정혁): 연동 시 GET /api/managers/notifications?user_id=... 응답으로 바꿔 주세요.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 계정 아이디 → 보낸 사람 정보 (이름·연락처) */
export function mockSender(userId: string | undefined): NotificationSender | null {
  const account = MOCK_MANAGER_ACCOUNTS.find((a) => a.userId === userId);
  return account ? { userId: account.userId, name: account.name, phone: account.phone } : null;
}

/** 그 차량을 담당 차량으로 가진 계정 아이디 (담당자 + 전체 관제) */
export function vehicleManagerIds(vehicleId: string): string[] {
  return MOCK_MANAGER_ACCOUNTS.filter((a) => a.assignedVehicleIds.includes(vehicleId)).map((a) => a.userId);
}

const MESSAGE: Record<AppNotification['type'], (vin: string) => string> = {
  departed: (vin) => `${vin} 차량이 운행을 시작했습니다.`,
  arrived: (vin) => `${vin} 차량이 목적지에 도착했습니다.`,
  faultReport: (vin) => `${vin} 차량 고장 신고가 접수되었습니다.`,
};

let nextId = 1;

/** 알림 한 줄 (받는 사람 한 명) */
export function makeMockNotification(
  vehicleId: string,
  type: AppNotification['type'],
  recipientUserId: string,
  senderUserId: string | undefined,
  createdAt = Date.now(),
): AppNotification {
  return {
    id: `n${nextId++}`,
    recipientUserId,
    vehicleId,
    type,
    sender: mockSender(senderUserId),
    message: MESSAGE[type](vehicleId),
    createdAt,
  };
}

/** 오늘 0시 기준으로 시각을 만듭니다 (예: 어제 16:48) */
function at(daysAgo: number, hour: number, minute: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * DAY + hour * HOUR + minute * MIN;
}

const now = Date.now();
/** 오늘 아침 운행 (앱을 아침 일찍 켜도 미래 시각이 되지 않게 맞춤) */
const todayArrived = Math.min(now - 20 * MIN, at(0, 9, 12));

/** 서버에 쌓여 있는 알림 (최신순이 아니어도 됩니다. 조회할 때 정렬) */
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  // 오늘: 최총괄이 1호차를 운행시키고 알림 받을 담당자를 김관제로 지정
  makeMockNotification('X3S1181', 'departed', 'manager1', 'admin', todayArrived - 7 * MIN),
  makeMockNotification('X3S1181', 'arrived', 'manager1', 'admin', todayArrived),
  // 어제: 이순찰이 2호차를 운행시키고 알림 받을 담당자를 최총괄로 지정
  makeMockNotification('X3S1182', 'departed', 'admin', 'manager2', at(1, 16, 40)),
  makeMockNotification('X3S1182', 'arrived', 'admin', 'manager2', at(1, 16, 48)),
  // 어제: 김관제가 1호차 고장 신고 → 1호차 담당자 모두(김관제, 최총괄)에게
  ...vehicleManagerIds('X3S1181').map((id) => makeMockNotification('X3S1181', 'faultReport', id, 'manager1', at(1, 11, 5))),
  // 3일 전: 김관제가 직접 운행시키고 본인을 알림 받을 담당자로 지정
  makeMockNotification('X3S1181', 'departed', 'manager1', 'manager1', at(3, 10, 22)),
  makeMockNotification('X3S1181', 'arrived', 'manager1', 'manager1', at(3, 10, 30)),
];
