import { getCalendarClient, getCalendarClientForUser } from './google-auth.js';
import { withRoomLock } from './booking-lock.js';
import { getRoomsByMinCapacity, ROOMS } from '../config/rooms.js';
import { env } from '../config/env.js';
import type { Room, BookingRequest, BookingEvent } from '../types/index.js';
import { calendar_v3 } from 'googleapis';

/**
 * 특정 시간대에 예약 가능한 미팅룸 목록 조회
 * Google Calendar FreeBusy API 사용
 */
export async function getAvailableRooms(
  startTime: Date,
  endTime: Date,
  minCapacity: number,
): Promise<Room[]> {
  const candidateRooms = getRoomsByMinCapacity(minCapacity);
  if (candidateRooms.length === 0) return [];

  const calendar = getCalendarClient();

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        timeZone: env.google.timezone,
        items: candidateRooms.map((room) => ({ id: room.id })),
      },
    });

    const calendars = response.data.calendars ?? {};
    const availableRooms: Room[] = [];

    for (const room of candidateRooms) {
      const calendarData = calendars[room.id];
      const busySlots = calendarData?.busy ?? [];

      // busy 배열이 비어있으면 해당 시간대에 예약 가능
      if (busySlots.length === 0) {
        availableRooms.push(room);
      }
    }

    return availableRooms;
  } catch (error) {
    console.error('FreeBusy API 오류:', error);
    throw new Error('⚠️ 미팅룸 가용성 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

/**
 * 미팅룸 예약 생성
 * withRoomLock으로 race condition 방지
 * FreeBusy 재확인 후 events.insert
 * responseStatus polling으로 auto-decline 감지
 */
export async function createBooking(request: BookingRequest): Promise<string> {
  const { room, startTime, endTime, title, attendees, organizer, recurrence } = request;

  return withRoomLock(room.id, async () => {
    // Lock 내부에서 FreeBusy 재확인 (race condition 방지)
    const calendar = getCalendarClient();

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        timeZone: env.google.timezone,
        items: [{ id: room.id }],
      },
    });

    const busySlots =
      freeBusyResponse.data.calendars?.[room.id]?.busy ?? [];

    if (busySlots.length > 0) {
      throw new Error(
        `😔 ${room.name}은(는) 해당 시간대에 이미 예약되어 있습니다.`,
      );
    }

    // organizer 이메일로 impersonation하여 이벤트 생성 (초대장 발송자)
    const userCalendar = getCalendarClientForUser(organizer);

    const eventResponse = await userCalendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: {
        summary: title,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: env.google.timezone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: env.google.timezone,
        },
        attendees: [
          { email: room.id, resource: true },
          ...attendees.map((a) => ({ email: a.email, displayName: a.name })),
        ],
        extendedProperties: {
          private: {
            createdBy: 'slack-room-bot',
          },
        },
        ...(recurrence && recurrence.length > 0 ? { recurrence } : {}),
      },
    });

    const eventId = eventResponse.data.id;
    if (!eventId) {
      throw new Error('⚠️ 이벤트 생성에 실패했습니다.');
    }

    // responseStatus polling: 미팅룸 auto-decline 감지
    // 최대 10초 (2초 간격 × 5회)
    const MAX_POLLS = 5;
    const POLL_INTERVAL_MS = 2000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      try {
        const eventDetail = await userCalendar.events.get({
          calendarId: 'primary',
          eventId,
        });

        const roomAttendee = eventDetail.data.attendees?.find(
          (a) => a.email === room.id,
        );

        if (roomAttendee?.responseStatus === 'accepted') {
          // 미팅룸이 예약을 수락함
          return eventId;
        }

        if (roomAttendee?.responseStatus === 'declined') {
          // 미팅룸이 예약을 거절함 — 이벤트 삭제 후 에러
          try {
            await userCalendar.events.delete({
              calendarId: 'primary',
              eventId,
              sendUpdates: 'all',
            });
          } catch {
            // 삭제 실패는 무시 (이미 삭제되었을 수 있음)
          }
          throw new Error(
            `😔 ${room.name}이(가) 예약을 거절했습니다. 미팅룸 자동 수락 설정을 확인해주세요.`,
          );
        }

        // 'needsAction' 상태 — 계속 대기
      } catch (error) {
        if (error instanceof Error && error.message.includes('거절')) {
          throw error;
        }
        // polling 중 일시적 오류는 무시하고 계속
      }
    }

    // polling 타임아웃 — FreeBusy로 이미 확인했으므로 낙관적 성공 처리
    return eventId;
  });
}

/**
 * 특정 미팅룸이 from 시각부터 얼마나 사용 가능한지 확인
 * 다음 예약의 시작 시간을 반환, 없으면 null (오늘 종일 가능)
 */
export async function getRoomAvailableUntil(
  room: Room,
  from: Date,
): Promise<Date | null> {
  const calendar = getCalendarClient();

  // 오늘 자정까지 조회
  const { endOfDay } = getKSTDayRange(from);

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: from.toISOString(),
        timeMax: endOfDay.toISOString(),
        timeZone: env.google.timezone,
        items: [{ id: room.id }],
      },
    });

    const busySlots = response.data.calendars?.[room.id]?.busy ?? [];

    if (busySlots.length === 0) {
      return null; // 오늘 종일 가능
    }

    // 첫 번째 busy 슬롯의 시작 시간 반환
    const firstBusy = busySlots[0];
    if (firstBusy?.start) {
      return new Date(firstBusy.start);
    }

    return null;
  } catch (error) {
    console.error('getRoomAvailableUntil 오류:', error);
    return null; // 오류 시 종일 가능으로 처리
  }
}

/**
 * 특정 미팅룸의 특정 날짜 예약 목록 조회
 * extendedProperties로 봇이 생성한 이벤트만 필터
 */
function getKSTDayRange(date: Date): { startOfDay: Date; endOfDay: Date } {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    startOfDay: new Date(`${y}-${mo}-${d}T00:00:00+09:00`),
    endOfDay: new Date(`${y}-${mo}-${d}T23:59:59+09:00`),
  };
}

function getRoomCalendarClient() {
  const adminEmail = process.env['GOOGLE_ADMIN_EMAIL'];
  if (adminEmail) {
    return getCalendarClientForUser(adminEmail);
  }
  return getCalendarClient();
}

export async function listRoomEvents(roomId: string, date: Date): Promise<BookingEvent[]> {
  const { startOfDay, endOfDay } = getKSTDayRange(date);

  // 1차: events.list로 상세 정보 조회 시도 (admin 위장)
  try {
    const calendar = getRoomCalendarClient();
    const response = await calendar.events.list({
      calendarId: roomId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items ?? [];
    const result = events
      .filter((e: calendar_v3.Schema$Event) => e.start?.dateTime && e.end?.dateTime)
      .map((e: calendar_v3.Schema$Event) => ({
        eventId: e.id ?? '',
        summary: e.summary ?? '(제목 없음)',
        startTime: new Date(e.start!.dateTime!),
        endTime: new Date(e.end!.dateTime!),
        organizer: e.organizer?.email ?? '',
        creator: e.creator?.email ?? '',
        attendees: (e.attendees ?? []).map((a: calendar_v3.Schema$EventAttendee) => a.email ?? '').filter(Boolean),
        roomId,
        roomName: '',
      }));

    // events.list 성공했지만 빈 배열인 경우 — 권한 부족으로 이벤트가 숨겨졌을 수 있음
    // freebusy로 재확인
    if (result.length === 0) {
      return listRoomEventsFallback(roomId, startOfDay, endOfDay);
    }
    return result;
  } catch {
    // 2차: 권한 부족 시 freebusy.query로 시간대만 조회
    return listRoomEventsFallback(roomId, startOfDay, endOfDay);
  }
}

/** freebusy.query 기반 fallback — 서비스 계정 직접 인증 (위장 없음, getAvailableRooms와 동일) */
async function listRoomEventsFallback(
  roomId: string,
  startOfDay: Date,
  endOfDay: Date,
): Promise<BookingEvent[]> {
  const calendar = getCalendarClient();
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      timeZone: env.google.timezone,
      items: [{ id: roomId }],
    },
  });

  const busySlots = response.data.calendars?.[roomId]?.busy ?? [];
  return busySlots
    .filter((slot) => slot.start && slot.end)
    .map((slot) => ({
      eventId: '',
      summary: '(예약 있음)',
      startTime: new Date(slot.start!),
      endTime: new Date(slot.end!),
      organizer: '',
      creator: '',
      attendees: [],
      roomId,
      roomName: '',
    }));
}

/**
 * 사용자의 primary calendar에서 미팅룸 예약 목록 조회
 * room calendar 대신 user calendar을 직접 조회하여 ACL 문제 회피
 * room attendee가 있는 이벤트만 필터링
 */
  export async function listUserBookings(userEmail: string, date: Date): Promise<BookingEvent[]> {
  const calendar = getCalendarClientForUser(userEmail);
  const { startOfDay, endOfDay } = getKSTDayRange(date);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items ?? [];
  const roomIdSet = new Set(ROOMS.map(r => r.id));


  return events
    .filter((e: calendar_v3.Schema$Event) => e.start?.dateTime && e.end?.dateTime)
    .map((e: calendar_v3.Schema$Event) => {
      // resource 필드에 의존하지 않고, roomIdSet 매칭 또는 @resource.calendar.google.com suffix로 판별
      const roomAttendee = e.attendees?.find(a =>
        roomIdSet.has(a.email ?? '') || (a.email?.endsWith('@resource.calendar.google.com') ?? false)
      );
      const roomId = roomAttendee?.email ?? '';
      const room = ROOMS.find(r => r.id === roomId);
      return {
        eventId: e.id ?? '',
        summary: e.summary ?? '(제목 없음)',
        startTime: new Date(e.start!.dateTime!),
        endTime: new Date(e.end!.dateTime!),
        organizer: e.organizer?.email ?? '',
        creator: e.creator?.email ?? '',
        attendees: (e.attendees ?? []).map((a: calendar_v3.Schema$EventAttendee) => a.email ?? '').filter(Boolean),
        roomId,
        roomName: room?.name ?? '',
      };
    })
    .filter(e => e.roomId !== '');
}

/**
 * 사용자의 primary calendar에서 특정 이벤트 조회
 */
export async function getUserEvent(userEmail: string, eventId: string): Promise<BookingEvent | null> {
  const calendar = getCalendarClientForUser(userEmail);

  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    const e = response.data;
    if (!e.start?.dateTime || !e.end?.dateTime) return null;

    const roomIdSet = new Set(ROOMS.map(r => r.id));
      const roomAttendee = e.attendees?.find(a => roomIdSet.has(a.email ?? '') || (a.email?.endsWith('@resource.calendar.google.com') ?? false));
    const roomId = roomAttendee?.email ?? '';
    const room = ROOMS.find(r => r.id === roomId);

    return {
      eventId: e.id ?? '',
      summary: e.summary ?? '(제목 없음)',
      startTime: new Date(e.start!.dateTime!),
      endTime: new Date(e.end!.dateTime!),
      organizer: e.organizer?.email ?? '',
      creator: e.creator?.email ?? '',
      attendees: (e.attendees ?? []).map((a: calendar_v3.Schema$EventAttendee) => a.email ?? '').filter(Boolean),
      roomId,
      roomName: room?.name ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * 예약 수정
 * GET → merge → PATCH 패턴으로 기존 참석자 유지
 * 반복 이벤트 수정 금지, 과거 이벤트 수정 금지
 */
export async function updateBooking(
  eventId: string,
  roomId: string,
  updates: { summary?: string; startTime?: Date; endTime?: Date; attendees?: string[] },
  organizerEmail?: string,
): Promise<void> {
  const calendar = organizerEmail
    ? getCalendarClientForUser(organizerEmail)
    : getRoomCalendarClient();
  const calendarId = organizerEmail ? 'primary' : roomId;

  // 기존 이벤트 조회 (GET → merge → PATCH 패턴)
  const existing = await calendar.events.get({ calendarId, eventId });

  // 반복 이벤트 수정 금지
  if (existing.data.recurringEventId) {
    throw new Error('반복 이벤트는 수정할 수 없습니다.');
  }

  // 과거 이벤트 수정 금지
  const startTime = updates.startTime ?? new Date(existing.data.start?.dateTime ?? '');
  if (startTime.getTime() < Date.now()) {
    throw new Error('이미 지난 예약은 수정할 수 없습니다.');
  }

  // 참석자 병합 (기존 참석자 유지 + 새 참석자 추가)
  const existingAttendees = existing.data.attendees ?? [];
  const newAttendeeEmails = updates.attendees ?? [];
  const mergedAttendees = newAttendeeEmails.length > 0
    ? newAttendeeEmails.map(email => ({ email }))
    : existingAttendees;

  const patch: Record<string, unknown> = {};
  if (updates.summary) patch['summary'] = updates.summary;
  if (updates.startTime) patch['start'] = { dateTime: updates.startTime.toISOString(), timeZone: env.google.timezone };
  if (updates.endTime) patch['end'] = { dateTime: updates.endTime.toISOString(), timeZone: env.google.timezone };
  if (newAttendeeEmails.length > 0) patch['attendees'] = mergedAttendees;

  await calendar.events.patch({
    calendarId,
    eventId,
    sendUpdates: 'all',
    requestBody: patch,
  });
}

/**
 * 예약 취소 (이벤트 삭제)
 * 410 Gone / 404 Not Found 그레이스풀 처리
 */
export async function cancelBooking(eventId: string, roomId: string, organizerEmail?: string): Promise<void> {
  const calendar = organizerEmail
    ? getCalendarClientForUser(organizerEmail)
    : getRoomCalendarClient();
  const calendarId = organizerEmail ? 'primary' : roomId;

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all',
    });
  } catch (err: unknown) {
    // 410 Gone: 이미 삭제된 이벤트 → 그레이스풀 처리
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 410) {
      return;
    }
    // 404 Not Found: 존재하지 않는 이벤트 → 그레이스풀 처리
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 404) {
      return;
    }
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
