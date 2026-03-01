import type { App } from '@slack/bolt';
import type { BookingRequest } from '../../types/index.js';
import { createBooking } from '../../services/calendar.js';
import { getRoomById } from '../../config/rooms.js';
import { buildEndTimeModal } from '../../views/result-views.js';
import { getRoomAvailableUntil } from '../../services/calendar.js';
import { pendingBookings } from '../views/book-submit.js';

export function registerRoomSelectActions(app: App): void {
  // /book 흐름: 회의실 선택 버튼
  app.action('select_room', async ({ ack, action, body, client, logger }) => {
    await ack();

    try {
      // action.value에서 {bookingId, roomId} 파싱
      const actionValue = (action as { value?: string }).value ?? '';
      let bookingId = '';
      let roomId = '';
      try {
        const parsed = JSON.parse(actionValue) as { bookingId?: string; roomId?: string };
        bookingId = parsed.bookingId ?? '';
        roomId = parsed.roomId ?? '';
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⚠️ 예약 정보를 파싱할 수 없습니다.',
        });
        return;
      }

      const booking = pendingBookings.get(bookingId);
      if (!booking) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⏰ 예약 세션이 만료되었습니다. `/book`을 다시 실행해주세요.',
        });
        return;
      }

      const room = getRoomById(roomId);
      if (!room) {
        await client.chat.postMessage({
          channel: booking.channelId || body.user.id,
          text: '⚠️ 선택한 회의실을 찾을 수 없습니다.',
        });
        return;
      }

      // 예약자 이메일 조회
      let organizerEmail = '';
      try {
        const userInfo = await client.users.info({ user: body.user.id });
        organizerEmail = userInfo.user?.profile?.email ?? '';
      } catch {
        // 이메일 조회 실패 시 빈 문자열
      }

      const bookingRequest: BookingRequest = {
        room,
        startTime: booking.startTime,
        endTime: booking.endTime!,
        title: booking.meetingTitle || `[회의실 예약] ${room.name}`,
        attendees: booking.attendees,
        organizer: organizerEmail,
      };

      const eventId = await createBooking(bookingRequest);
      logger.info(`예약 완료: eventId=${eventId}, room=${room.name}`);

      // 예약 완료 후 상태 정리
      pendingBookings.delete(bookingId);

      const attendeeNames =
        booking.attendees.length > 0
          ? booking.attendees.map((a) => a.name).join(', ')
          : '없음';

      await client.chat.postMessage({
        channel: booking.channelId || body.user.id,
        text: `✅ *예약 완료!*\n*회의 이름:* ${booking.meetingTitle || '(없음)'}\n*회의실:* ${room.name} (최대 ${room.capacity}인)\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`,
      });
    } catch (error) {
      logger.error('select_room 액션 처리 오류:', error);
      const errorMessage =
        error instanceof Error ? error.message : '⚠️ 예약 처리 중 오류가 발생했습니다.';
      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ ${errorMessage}`,
      });
    }
  });

  // /now-book 흐름: 회의실 선택 버튼 → 종료 시간 선택 모달 오픈
  app.action('select_room_now', async ({ ack, action, body, client, logger }) => {
    await ack();

    try {
      const actionValue = (action as { value?: string }).value ?? '';
      let bookingId = '';
      let roomId = '';
      try {
        const parsed = JSON.parse(actionValue) as { bookingId?: string; roomId?: string };
        bookingId = parsed.bookingId ?? '';
        roomId = parsed.roomId ?? '';
      } catch {
        logger.error('select_room_now: action.value 파싱 실패');
        return;
      }

      const booking = pendingBookings.get(bookingId);
      if (!booking) {
        logger.warn('select_room_now: 만료된 예약 세션');
        return;
      }

      const room = getRoomById(roomId);
      if (!room) {
        logger.warn('select_room_now: 회의실을 찾을 수 없음');
        return;
      }

      // 회의실 가용 시간 조회
      const availableUntil = await getRoomAvailableUntil(room, booking.startTime);

      // 종료 시간 선택 모달 오픈
      const triggerId = (body as { trigger_id?: string }).trigger_id;
      if (!triggerId) return;

      await client.views.open({
        trigger_id: triggerId,
        view: buildEndTimeModal(room, availableUntil, bookingId),
      });
    } catch (error) {
      logger.error('select_room_now 액션 처리 오류:', error);
    }
  });
}
