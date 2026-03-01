/**
 * 공통 유틸리티 함수
 */

export interface TimeOption {
  text: { type: 'plain_text'; text: string; emoji: boolean };
  value: string;
}

/**
 * 00:00 ~ 23:30 사이의 30분 단위 시간 옵션 48개 생성
 */
export function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      const time = `${h}:${m}`;
      options.push({
        text: { type: 'plain_text', text: time, emoji: false },
        value: time,
      });
    }
  }
  return options;
}

/**
 * Date를 한국어 날짜/시간 형식으로 포맷
 * 예: "3월 1일 (금) 14:00"
 */
export function formatDateTime(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 (${dayOfWeek}) ${hours}:${minutes}`;
}

/**
 * 시간 범위를 포맷
 * 예: "14:00 ~ 15:30"
 */
export function formatTimeRange(start: Date, end: Date): string {
  const startH = String(start.getHours()).padStart(2, '0');
  const startM = String(start.getMinutes()).padStart(2, '0');
  const endH = String(end.getHours()).padStart(2, '0');
  const endM = String(end.getMinutes()).padStart(2, '0');
  return `${startH}:${startM} ~ ${endH}:${endM}`;
}

/**
 * 날짜 문자열(YYYY-MM-DD)과 시간 문자열(HH:MM)을 Date로 변환
 */
export function parseDateTimeString(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year!, month! - 1, day!, hour!, minute!, 0, 0);
}
