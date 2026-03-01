import type { App } from '@slack/bolt';
import type { Attendee, BookingRequest, PendingBooking } from '../../types/index.js';
import { getAvailableRooms, createBooking } from '../../services/calendar.js';
import { buildRoomSelectionForm, buildProcessingView, buildErrorView } from '../../views/result-views.js';
import { parseDateTimeString, formatDateTime } from '../../views/common.js';
import { getRoomById, getRoomsByType } from '../../config/rooms.js';

// 대기 중인 예약 상태 저장 (모달 → 버튼 흐름)
export const pendingBookings = new Map<string, PendingBooking>();

function generateBookingId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function registerBookSubmit(app: App): void {
  app.view('book_modal', async ({ ack, view, body, client, logger }) => {
    // 즉시 "처리 중" 화면으로 업데이트
    await ack({
      response_action: 'update',
      view: buildProcessingView(),
    });

    try {
      const values = view.state.values;

      // private_metadata에서 channelId, roomType 추출
      let channelId = '';
      let roomType: 'meeting' | 'focusing' = 'meeting';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as { channelId?: string; roomType?: string };
        channelId = meta.channelId ?? '';
        roomType = (meta.roomType === 'focusing') ? 'focusing' : 'meeting';
      } catch { /* 무시 */ }

      // 공통 폼 값 추출
      const dateStr = values['date_block']?.['date_input']?.selected_date;
      const startTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value;
      const endTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value;
      const meetingTitle = values['title_block']?.['title_input']?.value ?? '';

      if (!dateStr || !startTimeStr || !endTimeStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('필수 항목을 모두 입력해주세요.'),
        });
        return;
      }

      const startTime = parseDateTimeString(dateStr, startTimeStr);
      const endTime = parseDateTimeString(dateStr, endTimeStr);

      // 시간 유효성 검증
      const now = new Date();
      if (startTime <= now) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('시작 시간은 현재 시각 이후여야 합니다.'),
        });
        return;
      }

      if (endTime <= startTime) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('종료 시간은 시작 시간 이후여야 합니다.'),
        });
        return;
      }

      // 포커싱룸 분기
      if (roomType === 'focusing') {
        const focusingRooms = getRoomsByType('focusing');
        if (focusingRooms.length === 0) {
          await client.views.update({
            view_id: body.view?.id ?? '',
            view: buildErrorView('😔 포커싱룸이 설정되어 있지 않습니다.'),
          });
          return;
        }

        const bookingId = generateBookingId();
        const booking: PendingBooking = {
          id: bookingId,
          startTime,
          endTime,
          capacity: 1,
          attendees: [],
          channelId,
          userId: body.user.id,
          availableRooms: focusingRooms,
          meetingTitle,
        };
        pendingBookings.set(bookingId, booking);
        setTimeout(() => pendingBookings.delete(bookingId), 5 * 60 * 1000);

        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildRoomSelectionForm(focusingRooms, bookingId),
        });
        return;
      }

      // --- 회의실 흐름 ---
      const capacityStr = values['capacity_block']?.['capacity_input']?.value;
      const selectedOptions = values['attendees_block']?.['attendees_input']?.selected_options ?? [];

      if (!capacityStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('필수 항목을 모두 입력해주세요.'),
        });
        return;
      }

      const capacity = parseInt(capacityStr, 10);
      if (isNaN(capacity) || capacity < 1 || capacity > 50) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('인원수는 1~50 사이로 입력해주세요.'),
        });
        return;
      }

      // 참석자 목록 구성
      const attendees: Attendee[] = selectedOptions.map((opt) => ({
        name: opt.text.text,
        email: opt.value,
      }));

      // 가용 회의실 조회
      const availableRooms = await getAvailableRooms(startTime, endTime, capacity);

      if (availableRooms.length === 0) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('😔 해당 시간대에 조건에 맞는 예약 가능한 회의실이 없습니다.'),
        });
        return;
      }

      // 예약 상태 저장
      const bookingId = generateBookingId();
      const booking: PendingBooking = {
        id: bookingId,
        startTime,
        endTime,
        capacity,
        attendees,
        channelId,
        userId: body.user.id,
        availableRooms,
        meetingTitle,
      };
      pendingBookings.set(bookingId, booking);

      // 5분 후 자동 만료
      setTimeout(() => {
        pendingBookings.delete(bookingId);
      }, 5 * 60 * 1000);

      // 회의실 선택 메시지 표시 (모달 업데이트)
      await client.views.update({
        view_id: body.view?.id ?? '',
        view: buildRoomSelectionForm(availableRooms, bookingId),
      });
    } catch (error) {
      logger.error('book_modal 제출 처리 오류:', error);
      try {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'),
        });
      } catch {
        // 업데이트 실패 무시
      }
    }
  });

  app.view('book_room_select', async ({ ack, view, body, client, logger }) => {
    await ack({ response_action: 'clear' });

    try {
      // private_metadata에서 bookingId 추출
      let bookingId = '';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as { bookingId?: string };
        bookingId = meta.bookingId ?? '';
      } catch {
        await client.chat.postMessage({ channel: body.user.id, text: '⚠️ 예약 정보를 찾을 수 없습니다.' });
        return;
      }

      const booking = pendingBookings.get(bookingId);
      if (!booking) {
        await client.chat.postMessage({ channel: body.user.id, text: '⏰ 예약 세션이 만료되었습니다. `/book`을 다시 실행해주세요.' });
        return;
      }

      // 라디오 버튼에서 roomId 추출
      const roomId = view.state.values['room_select_block']?.['room_radio']?.selected_option?.value ?? '';
      const room = getRoomById(roomId);
      if (!room) {
        await client.chat.postMessage({ channel: body.user.id, text: '⚠️ 선택한 회의실을 찾을 수 없습니다.' });
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
      pendingBookings.delete(bookingId);

      const attendeeNames = booking.attendees.length > 0
        ? booking.attendees.map(a => a.name).join(', ')
        : '없음';

      await client.chat.postMessage({
        channel: booking.channelId || body.user.id,
        text: `✅ *예약 완료!*\n*회의 이름:* ${booking.meetingTitle || '(없음)'}\n*회의실:* ${room.name} (최대 ${room.capacity}인)\n*일시:* ${formatDateTime(booking.startTime)} ~ ${formatDateTime(booking.endTime!)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`,
      });
    } catch (error) {
      logger.error('book_room_select 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '⚠️ 예약 처리 중 오류가 발생했습니다.';
      await client.chat.postMessage({ channel: body.user.id, text: `❌ ${errorMessage}` });
    }
  });
}
