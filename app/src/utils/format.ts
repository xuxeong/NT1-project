/** 화면에 숫자·시각을 표시하는 공통 함수 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 시각 → 14:32 */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 걸린 시간 → 1분 미만 / 12분 / 1시간 / 1시간 5분 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '1분 미만';
  if (minutes < 60) return `${minutes}분`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)}시간 ${rest}분` : `${Math.floor(minutes / 60)}시간`;
}

/** 거리를 수치 칸(StatCell)용 [값, 단위]로. 1km 미만은 ['420', 'm'], 이상은 ['1.2', 'km'] */
export function splitDistance(meters: number): [string, string] {
  if (meters < 1000) return [`${Math.round(meters)}`, 'm'];
  return [(meters / 1000).toFixed(1), 'km'];
}
