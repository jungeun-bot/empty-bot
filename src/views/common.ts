/**
 * 공통 유틸리티 함수
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
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

/**
 * 사용자 입력 시간 문자열을 검증하고 HH:MM 형식으로 정규화
 * 유효하면 'HH:MM' 반환, 무효하면 null 반환
 */
export function validateTimeInput(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
