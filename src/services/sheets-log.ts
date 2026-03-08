import { getGoogleSheetsClient } from './google-auth.js';
import { env } from '../config/env.js';
import type { BookingRequest } from '../types/index.js';

const SHEET_NAME = '예약기록';

const HEADERS = [
  '예약일시',
  '예약자(이메일)',
  '회의실',
  '날짜',
  '시작시간',
  '종료시간',
  '회의제목',
  '참석자',
  '이벤트ID',
];

/**
 * 예약 생성 시 Google Sheets에 기록 추가
 * GOOGLE_SHEET_ID가 설정되지 않으면 조용히 스킵
 */
export async function logBookingToSheet(
  request: BookingRequest,
  eventId: string,
): Promise<void> {
  const sheetId = env.google.sheetId;
  if (!sheetId) {
    return; // 시트 ID 미설정 시 스킵
  }

  try {
    const sheets = getGoogleSheetsClient();

    // 헤더 행 확인 및 자동 생성
    await ensureHeaders(sheets, sheetId);

    const now = new Date();
    const kstNow = formatKST(now, 'datetime');
    const kstDate = formatKST(request.startTime, 'date');
    const kstStart = formatKST(request.startTime, 'time');
    const kstEnd = formatKST(request.endTime, 'time');

    const attendeeList = request.attendees
      .map((a) => a.name || a.email)
      .join(', ');

    const row = [
      kstNow,
      request.organizer,
      request.room.name,
      kstDate,
      kstStart,
      kstEnd,
      request.title,
      attendeeList,
      eventId,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    // 시트 기록 실패는 예약 자체에 영향을 주지 않음
    console.error('📊 Google Sheets 기록 실패 (예약은 정상 처리됨):', error);
  }
}

/**
 * 시트에 헤더가 없으면 자동 생성
 */
async function ensureHeaders(
  sheets: ReturnType<typeof getGoogleSheetsClient>,
  sheetId: string,
): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:I1`,
    });

    const firstRow = response.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      // 헤더 행 작성
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A1:I1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [HEADERS],
        },
      });
    }
  } catch (error) {
    // 시트가 없는 경우 — 시트 이름이 다를 수 있음
    // 기본 Sheet1에도 시도
    console.warn(`📊 '${SHEET_NAME}' 시트 접근 실패. 시트 이름을 확인해주세요:`, error);
  }
}

/**
 * KST 포맷 유틸리티
 */
function formatKST(date: Date, format: 'date' | 'time' | 'datetime'): string {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET);

  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');

  switch (format) {
    case 'date':
      return `${y}-${mo}-${d}`;
    case 'time':
      return `${h}:${mi}`;
    case 'datetime':
      return `${y}-${mo}-${d} ${h}:${mi}`;
  }
}
