import { getGoogleSheetsClient } from './google-auth.js';
import { env } from '../config/env.js';
import { getRoomById } from '../config/rooms.js';
import type { BookingRequest, BookingEvent } from '../types/index.js';

const HEADERS = [
  '구분',
  '기록일시',
  '예약자(이메일)',
  '회의실',
  '날짜',
  '시작시간',
  '종료시간',
  '회의제목',
  '참석자',
  '이벤트ID',
];

// 시트 이름 캐시 (첫 호출 시 자동 감지)
let cachedSheetName: string | null = null;

/**
 * 스프레드시트의 첫 번째 시트 이름을 자동 감지
 */
async function getSheetName(
  sheets: ReturnType<typeof getGoogleSheetsClient>,
  spreadsheetId: string,
): Promise<string> {
  if (cachedSheetName) return cachedSheetName;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  const firstSheet = meta.data.sheets?.[0]?.properties?.title;
  cachedSheetName = firstSheet ?? 'Sheet1';
  console.log(`📊 Google Sheets 시트 이름 감지: "${cachedSheetName}"`);
  return cachedSheetName;
}

/**
 * 공통: 시트에 행 추가
 */
async function appendRow(row: string[]): Promise<void> {
  const sheetId = env.google.sheetId;
  if (!sheetId) return;

  try {
    const sheets = getGoogleSheetsClient();
    const sheetName = await getSheetName(sheets, sheetId);

    await ensureHeaders(sheets, sheetId, sheetName);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    console.log(`📊 Google Sheets 기록 완료: [${row[0]}] ${row[3]} / ${row[7]}`);
  } catch (error) {
    const errDetail = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`📊 Google Sheets 기록 실패 (예약 처리에는 영향 없음): ${errDetail}`);
  }
}

/**
 * 예약 생성 시 Google Sheets에 기록 추가
 * GOOGLE_SHEET_ID가 설정되지 않으면 조용히 스킵
 */
export async function logBookingToSheet(
  request: BookingRequest,
  eventId: string,
): Promise<void> {
  const now = new Date();
  const attendeeList = request.attendees
    .map((a) => a.name || a.email)
    .join(', ');

  await appendRow([
    '예약',
    formatKST(now, 'datetime'),
    request.organizer,
    request.room.name,
    formatKST(request.startTime, 'date'),
    formatKST(request.startTime, 'time'),
    formatKST(request.endTime, 'time'),
    request.title,
    attendeeList,
    eventId,
  ]);
}

/**
 * 예약 취소 시 Google Sheets에 기록 추가
 */
export async function logCancelToSheet(
  organizerEmail: string,
  booking: BookingEvent,
): Promise<void> {
  const now = new Date();
  const roomName = booking.roomName || getRoomById(booking.roomId)?.name || booking.roomId;
  // summary에서 [RoomName] prefix 제거
  const title = booking.summary.replace(/^\[.*?\]\s*/, '');
  const attendeeList = booking.attendees
    .filter((email) => email !== booking.roomId)
    .join(', ');

  await appendRow([
    '취소',
    formatKST(now, 'datetime'),
    organizerEmail,
    roomName,
    formatKST(booking.startTime, 'date'),
    formatKST(booking.startTime, 'time'),
    formatKST(booking.endTime, 'time'),
    title,
    attendeeList,
    booking.eventId,
  ]);
}

/**
 * 예약 수정 시 Google Sheets에 기록 추가 (수정 후 값 기록)
 */
export async function logEditToSheet(
  organizerEmail: string,
  roomName: string,
  eventId: string,
  newSummary: string,
  newStartTime: Date,
  newEndTime: Date,
  attendees: string[],
): Promise<void> {
  const now = new Date();
  // summary에서 [RoomName] prefix 제거
  const title = newSummary.replace(/^\[.*?\]\s*/, '');
  const attendeeList = attendees.join(', ');

  await appendRow([
    '수정',
    formatKST(now, 'datetime'),
    organizerEmail,
    roomName,
    formatKST(newStartTime, 'date'),
    formatKST(newStartTime, 'time'),
    formatKST(newEndTime, 'time'),
    title,
    attendeeList,
    eventId,
  ]);
}

/**
 * 시트에 헤더가 없으면 자동 생성
 */
async function ensureHeaders(
  sheets: ReturnType<typeof getGoogleSheetsClient>,
  sheetId: string,
  sheetName: string,
): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A1:J1`,
    });

    const firstRow = response.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      // 헤더 행 작성
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${sheetName}'!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [HEADERS],
        },
      });
      console.log(`📊 헤더 행 자동 생성 완료 (시트: ${sheetName})`);
    }
  } catch (error) {
    const errDetail = error instanceof Error ? error.message : JSON.stringify(error);
    console.warn(`📊 헤더 확인 실패: ${errDetail}`);
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
