import type { AppNotification } from '@/types/notification';
import { formatClock } from '@/utils/format';
import { iGa } from '@/utils/korean';

/** 알림 제목 (메시지 탭 한 줄·새 알림 토스트). 예) X3S1181이 운행을 시작했어요 */
export function notificationText(n: AppNotification): { title: string } {
  const vin = n.vehicleId;
  switch (n.type) {
    case 'departed':
      return { title: `${vin}${iGa(vin)} 운행을 시작했어요` };
    case 'arrived':
      return { title: `${vin}${iGa(vin)} 목적지에 도착했어요` };
    case 'faultReport':
      return { title: `${vin} 고장 신고가 접수됐어요` };
  }
}

/** 알림 둘째 줄: 보낸 사람. 예) 김관제 (1호차 담당) · 010-1111-2222 */
export function notificationSenderText(n: AppNotification): string {
  return n.sender ? `${n.sender.name} · ${n.sender.phone}` : '보낸 사람 정보 없음';
}

/** 오늘 0시 (ms) */
function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 알림 묶음: 오늘 / 어제 / 그 전 */
export function notificationSection(createdAt: number): '오늘' | '어제' | '그 전' {
  const today = startOfToday();
  if (createdAt >= today) return '오늘';
  if (createdAt >= today - 24 * 60 * 60 * 1000) return '어제';
  return '그 전';
}

/** 알림 시각. 오늘·어제는 14:32, 그 전은 11/25 */
export function formatNotificationTime(createdAt: number): string {
  if (notificationSection(createdAt) !== '그 전') return formatClock(createdAt);
  const d = new Date(createdAt);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
