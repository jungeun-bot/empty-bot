import type { MentionIntent } from '../types/index.js';

/* ── KST 타임존 헬퍼 ───────────────────────────────────── */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC Date → KST 구성 요소 */
function getKSTComponents(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth(),
    day: kst.getUTCDate(),
    dayOfWeek: kst.getUTCDay(),
    hours: kst.getUTCHours(),
    minutes: kst.getUTCMinutes(),
  };
}

/** KST 연월일시분 → UTC Date */
function buildKSTDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0) - KST_OFFSET_MS);
}

/* ── 한국어 고유 수사 → 아라비아 숫자 변환 ────────────── */
const KOREAN_NATIVE_NUMS: [string, number][] = [
  ['열두', 12], ['열한', 11], ['열', 10],
  ['아홉', 9], ['여덟', 8], ['일곱', 7], ['여섯', 6],
  ['다섯', 5], ['네', 4], ['세', 3], ['두', 2], ['한', 1],
];

/** "두시" → "2시", "세명" → "3명" 등 한국어 고유 수사를 아라비아 숫자로 변환 */
function normalizeKoreanNumerals(text: string): string {
  let result = text;
  for (const [korean, num] of KOREAN_NATIVE_NUMS) {
    result = result.replace(new RegExp(`${korean}(?=\\s*(?:시|명|인))`, 'g'), String(num));
  }
  return result;
}

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
  // baseDate는 이미 KST 자정 기준 UTC Date
  const kst = getKSTComponents(baseDate);
  const currentDay = kst.dayOfWeek; // KST 기준 요일

  let daysToAdd: number;
  if (nextWeek) {
    daysToAdd = (7 - currentDay) + dayOfWeek;
  } else {
    daysToAdd = dayOfWeek - currentDay;
  }

  // baseDate에 일수를 더해서 새 KST 자정 Date 생성
  return new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

/**
 * 인원수를 파싱한다.
 * "4명", "10인" 등의 패턴 → 숫자, 없으면 null
 */
export function parseCapacity(text: string): number | null {
  const normalized = normalizeKoreanNumerals(text);
  const match = normalized.match(/(\d+)\s*[명인]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 한국어 시간 표현을 파싱하여 Date 를 반환한다.
 * 시간 표현이 없으면 현재 시각, 과거 시간이면 throw.
 */
export function parseKoreanTime(text: string): Date {
  const normalized = normalizeKoreanNumerals(text);
  const now = new Date();

  // 1. "지금" | "현재" | "바로"
  if (/지금|현재|바로/.test(normalized)) {
    return new Date();
  }

  // 2. "N시간 후/뒤"
  const hoursLaterMatch = normalized.match(/(\d+)\s*시간\s*[후뒤]/);
  if (hoursLaterMatch) {
    const hours = parseInt(hoursLaterMatch[1], 10);
    return new Date(now.getTime() + hours * 3600000);
  }

  // 3. "N분 후/뒤"
  const minsLaterMatch = normalized.match(/(\d+)\s*분\s*[후뒤]/);
  if (minsLaterMatch) {
    const mins = parseInt(minsLaterMatch[1], 10);
    return new Date(now.getTime() + mins * 60000);
  }

  // 4 & 5. 날짜 + 시각 조합 / 시각만 있는 경우
  const targetDate = parseDatePart(normalized, now);
  const result = parseTimePart(normalized, targetDate, now);

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
  const kst = getKSTComponents(now);
  // KST 오늘 자정을 UTC Date로
  const base = buildKSTDate(kst.year, kst.month, kst.day);

  // "내일"
  if (/내일/.test(text)) {
    return buildKSTDate(kst.year, kst.month, kst.day + 1);
  }

  // "모레"
  if (/모레/.test(text)) {
    return buildKSTDate(kst.year, kst.month, kst.day + 2);
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
      if (dayOfWeek >= kst.dayOfWeek) {
        return getTargetDate(base, dayOfWeek, false);
      } else {
        return getTargetDate(base, dayOfWeek, true);
      }
    }
  }

  // "N월 N일" — 3월 5일 → 해당 월/일 (올해, 이미 지났으면 내년)
  const monthDayMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10) - 1; // 0-indexed
    const day = parseInt(monthDayMatch[2], 10);
    let candidate = buildKSTDate(kst.year, month, day);
    if (candidate.getTime() < now.getTime()) {
      candidate = buildKSTDate(kst.year + 1, month, day);
    }
    return candidate;
  }

  // "N/N" — 3/5 → 3월 5일
  const slashDateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashDateMatch) {
    const month = parseInt(slashDateMatch[1], 10) - 1;
    const day = parseInt(slashDateMatch[2], 10);
    let candidate = buildKSTDate(kst.year, month, day);
    if (candidate.getTime() < now.getTime()) {
      candidate = buildKSTDate(kst.year + 1, month, day);
    }
    return candidate;
  }

  // "N일" (단독, "N월"이 없는 경우) — 5일 → 이번 달 5일 (지났으면 다음 달)
  const dayOnlyDateMatch = text.match(/(?<!\d\s*월\s*)(\d{1,2})\s*일(?!요일)/);
  if (dayOnlyDateMatch) {
    const day = parseInt(dayOnlyDateMatch[1], 10);
    let candidate = buildKSTDate(kst.year, kst.month, day);
    if (candidate.getTime() < now.getTime()) {
      candidate = buildKSTDate(kst.year, kst.month + 1, day);
    }
    return candidate;
  }

  // "다음 달" — 다음 달 1일
  if (/다음\s*달/.test(text)) {
    return buildKSTDate(kst.year, kst.month + 1, 1);
  }

  // 날짜 표현 없음 → 오늘
  return base;
}

/**
 * 텍스트에서 시각 부분을 파싱하여 targetDate 에 적용한다.
 * 시각 표현이 없으면 현재 시각을 사용.
 */
function parseTimePart(text: string, targetDate: Date, now: Date): Date {
  // targetDate는 KST 자정 기준 UTC Date (buildKSTDate로 생성됨)
  const kstTarget = getKSTComponents(targetDate);

  // "오전 N시"
  const amMatch = text.match(/오전\s*(\d{1,2})\s*시/);
  if (amMatch) {
    const hour = parseInt(amMatch[1], 10);
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour, 0);
  }

  // "오후 N시"
  const pmMatch = text.match(/오후\s*(\d{1,2})\s*시/);
  if (pmMatch) {
    const hour = parseInt(pmMatch[1], 10);
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour === 12 ? 12 : hour + 12, 0);
  }

  // "N시 N분"
  const hourMinMatch = text.match(/(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
  if (hourMinMatch) {
    let hour = parseInt(hourMinMatch[1], 10);
    const min = parseInt(hourMinMatch[2], 10);
    if (hour < 8) hour += 12;
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour, min);
  }

  // "N시 반"
  const hourHalfMatch = text.match(/(\d{1,2})\s*시\s*반/);
  if (hourHalfMatch) {
    let hour = parseInt(hourHalfMatch[1], 10);
    if (hour < 8) hour += 12;
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour, 30);
  }

  // "N시" (단독)
  const hourOnlyMatch = text.match(/(\d{1,2})\s*시/);
  if (hourOnlyMatch) {
    let hour = parseInt(hourOnlyMatch[1], 10);
    if (hour < 8) hour += 12;
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour, 0);
  }

  // "N" (숫자만) — 2 → 14:00, 14 → 14:00
  const bareNumberMatch = text.match(/(\d{1,2})(?!\s*[시분명인])/);
  if (bareNumberMatch) {
    let hour = parseInt(bareNumberMatch[1], 10);
    if (hour < 8) hour += 12;
    return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, hour, 0);
  }

  // 시각 표현 없음 → 현재 시각 사용
  const kstNow = getKSTComponents(now);
  return buildKSTDate(kstTarget.year, kstTarget.month, kstTarget.day, kstNow.hours, kstNow.minutes);
}

/**
 * 메시지 텍스트에서 미팅룸 예약 의도를 파싱한다.
 * 키워드가 없으면 null, 있으면 MentionIntent 반환.
 */
export function parseMessageIntent(text: string): MentionIntent | null {
  const normalized = normalizeKoreanNumerals(text);
  const hasIntent = INTENT_KEYWORDS.some((kw) => normalized.includes(kw));
  if (!hasIntent) {
    return null;
  }

  const capacity = parseCapacity(normalized);
  const parsedTime = parseKoreanTime(normalized);
  const endTime = new Date(parsedTime.getTime() + 3600000); // +1시간

  // 포커스룸 키워드 감지
  const isFocusRoom = /포커스룸|포커스 룸|포커싱룸|포커싱 룸|집중실|집중 공간/.test(normalized);

  return {
    parsedTime,
    endTime,
    capacity,
    rawTimeText: text,
    isBookingIntent: BOOKING_KEYWORDS.some(kw => normalized.includes(kw)),
    isEditIntent: EDIT_KEYWORDS.some(kw => normalized.includes(kw)),
    roomType: isFocusRoom ? 'focus' : undefined,
  };
}


export function parseAttendeeNames(text: string): string[] {
  const names = text.match(/[가-힣]{2,4}/g) ?? [];
  const excludeWords = ['회의실', '미팅룸', '미팅', '회의', '예약해줘', '예약해', '예약', '잡아줘', '잡아', '부탁해', '부탁',
    '시간', '분', '오전', '오후', '내일', '모레', '오늘', '다음', '이번', '월요일', '화요일',
    '수요일', '목요일', '금요일', '토요일', '일요일', '확인', '취소', '수정', '변경'];
  return names.filter(n => !excludeWords.includes(n));
}