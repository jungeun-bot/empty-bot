/**
 * 공통 유틸리티 함수
 */

export interface TimeOption {
  text: { type: 'plain_text'; text: string; emoji: boolean };
  value: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
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
  const kst = toKST(date);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayOfWeek = days[kst.getUTCDay()];
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 (${dayOfWeek}) ${hours}:${minutes}`;
}

/**
 * 시간 범위를 포맷
 * 예: "14:00 ~ 15:30"
 */
export function formatTimeRange(start: Date, end: Date): string {
  const startKst = toKST(start);
  const endKst = toKST(end);
  const startH = String(startKst.getUTCHours()).padStart(2, '0');
  const startM = String(startKst.getUTCMinutes()).padStart(2, '0');
  const endH = String(endKst.getUTCHours()).padStart(2, '0');
  const endM = String(endKst.getUTCMinutes()).padStart(2, '0');
  return `${startH}:${startM} ~ ${endH}:${endM}`;
}

/**
 * 날짜 문자열(YYYY-MM-DD)과 시간 문자열(HH:MM)을 Date로 변환
 */
export function parseDateTimeString(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+09:00`);
}
