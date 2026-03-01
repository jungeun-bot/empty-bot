import type { App } from '@slack/bolt';
import type { Attendee, BookingRequest } from '../../types/index.js';
import { createBooking } from '../../services/calendar.js';
import { getRoomById } from '../../config/rooms.js';
import { formatDateTime } from '../../views/common.js';
import { pendingBookings } from './book-submit.js';

export function registerNowBookSubmit(app: App): void {
  app.view('now_book_end_time', async ({ ack, view, body, client, logger }) => {
    // 즉시 "처리 중" 화면으로 업데이트
    await ack({ response_action: 'clear' });

    try {
      // private_metadata에서 bookingId, roomId 추출
      let bookingId = '';
      let roomId = '';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as {
          bookingId?: string;
          roomId?: string;
        };
        bookingId = meta.bookingId ?? '';
        roomId = meta.roomId ?? '';
      } catch {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⚠️ 예약 정보를 찾을 수 없습니다. 다시 시도해주세요.',
        });
        return;
      }

      const booking = pendingBookings.get(bookingId);
      if (!booking) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⏰ 예약 세션이 만료되었습니다. `/now-book`을 다시 실행해주세요.',
        });
        return;
      }

      const room = getRoomById(roomId);
      if (!room) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⚠️ 선택한 회의실을 찾을 수 없습니다.',
        });
        return;
      }

      // 사용 시간(분) 추출
      const durationStr = view.state.values['duration_block']?.['duration_input']?.selected_option?.value;
      const durationMinutes = parseInt(durationStr ?? '60', 10);

      const meetingTitle = view.state.values['title_block']?.['title_input']?.value ?? '';

      const selectedOptions = view.state.values['attendees_block']?.['attendees_input']?.selected_options ?? [];
      const modalAttendees: Attendee[] = selectedOptions.map((opt: { text: { text: string }; value: string }) => ({
        name: opt.text.text,
        email: opt.value,
      }));

      const startTime = booking.startTime;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // 예약자 이메일 조회
      let organizerEmail = '';
      try {
        const userInfo = await client.users.info({ user: body.user.id });
        organizerEmail = userInfo.user?.profile?.email ?? '';
      } catch {
        // 이메일 조회 실패 시 빈 문자열 (초대장 발송자 미지정)
      }

      const bookingRequest: BookingRequest = {
        room,
        startTime,
        endTime,
        title: meetingTitle || `[회의실 예약] ${room.name}`,
        attendees: modalAttendees,
        organizer: organizerEmail,
      };

      const eventId = await createBooking(bookingRequest);
      logger.info(`예약 완료: eventId=${eventId}, room=${room.name}`);

      // 예약 완료 후 상태 정리
      pendingBookings.delete(bookingId);

      const attendeeNames = modalAttendees.length > 0
        ? modalAttendees.map(a => a.name).join(', ')
        : '없음';
      await client.chat.postMessage({
        channel: booking.channelId || body.user.id,
        text: `✅ *예약 완료!*\n*회의 이름:* ${meetingTitle || '(없음)'}\n*회의실:* ${room.name} (최대 ${room.capacity}인)\n*일시:* ${formatDateTime(startTime)} ~ ${formatDateTime(endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`,
      });
    } catch (error) {
      logger.error('now_book_end_time 제출 처리 오류:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : '⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      try {
        await client.chat.postMessage({ channel: body.user.id, text: `❌ ${errorMessage}` });
      } catch {
        // 메시지 전송 실패 무시
      }
    }
  });
}
