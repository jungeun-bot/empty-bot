import type { MentionIntent } from '../types/index.js';

const INTENT_KEYWORDS = ['회의실', '미팅룸', '미팅', '회의', '빈방', '비어있', '예약', '가능', '사용'];

const BOOKING_KEYWORDS = ['예약해줘', '예약해', '예약 해줘', '잡아줘', '잡아', '부탁해', '부탁', '예약'];
const EDIT_KEYWORDS = ['수정해줘', '변경해줘', '취소해줘', '수정', '변경', '취소', '바꿔줘'];

const DAY_MAP: Record<string, number> = {
  '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
};

/**
 * 해당 요일까지 날짜를 계산한다.
 * nextWeek=true 이면 무조건 다음 주, false 이면 이번 주.
 * 단독 요일(nextWeek 미지정)은 호출부에서 별도 처리.
 */
export function getTargetDate(baseDate: Date, dayOfWeek: number, nextWeek: boolean): Date {
  const result = new Date(baseDate);
  const currentDay = result.getDay(); // 0=일 ~ 6=토

  if (nextWeek) {
    // 다음 주 해당 요일: 이번 주 남은 일수 + 해당 요일
    const daysUntilNextWeek = (7 - currentDay) + dayOfWeek;
    result.setDate(result.getDate() + daysUntilNextWeek);
  } else {
    // 이번 주 해당 요일
    const diff = dayOfWeek - currentDay;
    result.setDate(result.getDate() + diff);
  }

  return result;
}

/**
 * 인원수를 파싱한다.
 * "4명", "10인" 등의 패턴 → 숫자, 없으면 null
 */
export function parseCapacity(text: string): number | null {
  const match = text.match(/(\d+)\s*[명인]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 한국어 시간 표현을 파싱하여 Date 를 반환한다.
 * 시간 표현이 없으면 현재 시각, 과거 시간이면 throw.
 */
export function parseKoreanTime(text: string): Date {
  const now = new Date();

  // 1. "지금" | "현재" | "바로"
  if (/지금|현재|바로/.test(text)) {
    return new Date();
  }

  // 2. "N시간 후/뒤"
  const hoursLaterMatch = text.match(/(\d+)\s*시간\s*[후뒤]/);
  if (hoursLaterMatch) {
    const hours = parseInt(hoursLaterMatch[1], 10);
    return new Date(now.getTime() + hours * 3600000);
  }

  // 3. "N분 후/뒤"
  const minsLaterMatch = text.match(/(\d+)\s*분\s*[후뒤]/);
  if (minsLaterMatch) {
    const mins = parseInt(minsLaterMatch[1], 10);
    return new Date(now.getTime() + mins * 60000);
  }

  // 4 & 5. 날짜 + 시각 조합 / 시각만 있는 경우
  const targetDate = parseDatePart(text, now);
  const result = parseTimePart(text, targetDate, now);

  // 파싱된 시간이 현재보다 과거면 throw
  if (result.getTime() < now.getTime()) {
    throw new Error('이미 지난 시간입니다');
  }

  return result;
}

/**
 * 텍스트에서 날짜 부분을 파싱한다.
 * 날짜 표현이 없으면 오늘 날짜를 반환.
 */
export function parseDatePart(text: string, now: Date): Date {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  // "내일"
  if (/내일/.test(text)) {
    base.setDate(base.getDate() + 1);
    return base;
  }

  // "모레"
  if (/모레/.test(text)) {
    base.setDate(base.getDate() + 2);
    return base;
  }

  // "오늘"
  if (/오늘/.test(text)) {
    return base;
  }

  // "다음 주 X요일"
  const nextWeekDayMatch = text.match(/다음\s*주\s*([월화수목금토일])요일?/);
  if (nextWeekDayMatch) {
    const dayOfWeek = DAY_MAP[nextWeekDayMatch[1]];
    if (dayOfWeek !== undefined) {
      return getTargetDate(base, dayOfWeek, true);
    }
  }

  // "이번 주 X요일"
  const thisWeekDayMatch = text.match(/이번\s*주\s*([월화수목금토일])요일?/);
  if (thisWeekDayMatch) {
    const dayOfWeek = DAY_MAP[thisWeekDayMatch[1]];
    if (dayOfWeek !== undefined) {
      return getTargetDate(base, dayOfWeek, false);
    }
  }

  // "X요일" (단독) → 다가오는 해당 요일 (오늘 포함, 이미 지났으면 다음 주)
  const dayOnlyMatch = text.match(/([월화수목금토일])요일/);
  if (dayOnlyMatch) {
    const dayOfWeek = DAY_MAP[dayOnlyMatch[1]];
    if (dayOfWeek !== undefined) {
      const currentDay = now.getDay();
      if (dayOfWeek >= currentDay) {
        // 오늘 이후(오늘 포함)
        return getTargetDate(base, dayOfWeek, false);
      } else {
        // 이미 지났으면 다음 주
        return getTargetDate(base, dayOfWeek, true);
      }
    }
  }

  // "N월 N일" — 3월 5일 → 해당 월/일 (올해, 이미 지났으면 내년)
  const monthDayMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10) - 1; // 0-indexed
    const day = parseInt(monthDayMatch[2], 10);
    base.setMonth(month, day);
    if (base.getTime() < now.getTime()) {
      base.setFullYear(base.getFullYear() + 1);
    }
    return base;
  }

  // "N/N" — 3/5 → 3월 5일
  const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashDateMatch) {
    const month = parseInt(slashDateMatch[1], 10) - 1;
    const day = parseInt(slashDateMatch[2], 10);
    base.setMonth(month, day);
    if (base.getTime() < now.getTime()) {
      base.setFullYear(base.getFullYear() + 1);
    }
    return base;
  }

  // "N일" (단독, "N월"이 없는 경우) — 5일 → 이번 달 5일 (지났으면 다음 달)
  const dayOnlyDateMatch = text.match(/(?<!\d\s*월\s*)(\d{1,2})\s*일(?!요일)/);
  if (dayOnlyDateMatch) {
    const day = parseInt(dayOnlyDateMatch[1], 10);
    base.setDate(day);
    if (base.getTime() < now.getTime()) {
      base.setMonth(base.getMonth() + 1);
    }
    return base;
  }

  // "다음 달" — 다음 달 1일
  if (/다음\s*달/.test(text)) {
    base.setMonth(base.getMonth() + 1, 1);
    return base;
  }

  // 날짜 표현 없음 → 오늘
  return base;
}

/**
 * 텍스트에서 시각 부분을 파싱하여 targetDate 에 적용한다.
 * 시각 표현이 없으면 현재 시각을 사용.
 */
function parseTimePart(text: string, targetDate: Date, now: Date): Date {
  const result = new Date(targetDate);

  // "오전 N시"
  const amMatch = text.match(/오전\s*(\d{1,2})\s*시/);
  if (amMatch) {
    const hour = parseInt(amMatch[1], 10);
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  // "오후 N시"
  const pmMatch = text.match(/오후\s*(\d{1,2})\s*시/);
  if (pmMatch) {
    const hour = parseInt(pmMatch[1], 10);
    result.setHours(hour === 12 ? 12 : hour + 12, 0, 0, 0);
    return result;
  }

  // "N시 N분"
  const hourMinMatch = text.match(/(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
  if (hourMinMatch) {
    let hour = parseInt(hourMinMatch[1], 10);
    const min = parseInt(hourMinMatch[2], 10);
    if (hour < 8) {
      hour += 12;
    }
    result.setHours(hour, min, 0, 0);
    return result;
  }

  // "N시 반"
  const hourHalfMatch = text.match(/(\d{1,2})\s*시\s*반/);
  if (hourHalfMatch) {
    let hour = parseInt(hourHalfMatch[1], 10);
    if (hour < 8) {
      hour += 12;
    }
    result.setHours(hour, 30, 0, 0);
    return result;
  }

  // "N시" (단독)
  const hourOnlyMatch = text.match(/(\d{1,2})\s*시/);
  if (hourOnlyMatch) {
    let hour = parseInt(hourOnlyMatch[1], 10);
    if (hour < 8) {
      hour += 12;
    }
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  // "N" (숫자만) — 2 → 14:00, 14 → 14:00
  const bareNumberMatch = text.match(/(\d{1,2})(?!\s*[시분명인])/);
  if (bareNumberMatch) {
    let hour = parseInt(bareNumberMatch[1], 10);
    if (hour < 8) hour += 12; // 업무시간 8:00~19:00 기준
    result.setHours(hour, 0, 0, 0);
    return result;
  }

  // 시각 표현 없음 → 현재 시각 사용
  result.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return result;
}

/**
 * 메시지 텍스트에서 회의실 예약 의도를 파싱한다.
 * 키워드가 없으면 null, 있으면 MentionIntent 반환.
 */
export function parseMessageIntent(text: string): MentionIntent | null {
  const hasIntent = INTENT_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasIntent) {
    return null;
  }

  const capacity = parseCapacity(text);
  const parsedTime = parseKoreanTime(text);
  const endTime = new Date(parsedTime.getTime() + 3600000); // +1시간

  // 포커싱룸 키워드 감지
  const isFocusingRoom = /포커싱룸|포커싱 룸|집중실|집중 공간/.test(text);

  return {
    parsedTime,
    endTime,
    capacity,
    rawTimeText: text,
    isBookingIntent: BOOKING_KEYWORDS.some(kw => text.includes(kw)),
    isEditIntent: EDIT_KEYWORDS.some(kw => text.includes(kw)),
    roomType: isFocusingRoom ? 'focusing' : undefined,
  };
}


export function parseAttendeeNames(text: string): string[] {
  const names = text.match(/[가-힣]{2,4}/g) ?? [];
  const excludeWords = ['회의실', '미팅룸', '미팅', '회의', '예약해줘', '예약해', '예약', '잡아줘', '잡아', '부탁해', '부탁',
    '시간', '분', '오전', '오후', '내일', '모레', '오늘', '다음', '이번', '월요일', '화요일',
    '수요일', '목요일', '금요일', '토요일', '일요일', '확인', '취소', '수정', '변경'];
  return names.filter(n => !excludeWords.includes(n));
}