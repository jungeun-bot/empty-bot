import type { App } from '@slack/bolt';
import { listRoomEvents, updateBooking, cancelBooking } from '../../services/calendar.js';
import { sendChangeNotification, sendCancelNotification } from '../../services/notification.js';
import type { BookingChanges } from '../../services/notification.js';
import { buildBookingListModal, buildEditBookingModal, buildCancelConfirmModal } from '../../views/edit-modal.js';
import { buildProcessingView, buildErrorView } from '../../views/result-views.js';
import { parseDateTimeString } from '../../views/common.js';
import { getRoomById } from '../../config/rooms.js';

export function registerEditSubmit(app: App): void {
  // 1. 날짜/회의실 선택 → 예약 목록 조회
  app.view('edit_date_room_select', async ({ ack, view, body, client, logger }) => {
    await ack({
      response_action: 'update',
      view: buildProcessingView(),
    });

    try {
      const values = view.state.values;
      const dateStr = values['date_block']?.['date_input']?.selected_date;
      const roomId = values['room_block']?.['room_input']?.selected_option?.value;

      if (!dateStr || !roomId) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('날짜와 회의실을 선택해주세요.'),
        });
        return;
      }

      // 예약자 이메일 조회
      let organizerEmail = '';
      try {
        const userInfo = await client.users.info({ user: body.user.id });
        organizerEmail = userInfo.user?.profile?.email ?? '';
      } catch {
        // 이메일 조회 실패
      }

      const date = new Date(dateStr + 'T00:00:00');
      const bookings = await listRoomEvents(roomId, date);

      // 본인 예약만 필터
      const myBookings = bookings.filter(b => b.organizer === organizerEmail);

      if (myBookings.length === 0) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('해당 날짜에 수정 가능한 예약이 없습니다.'),
        });
        return;
      }

      await client.views.update({
        view_id: body.view?.id ?? '',
        view: buildBookingListModal(myBookings, roomId),
      });
    } catch (error) {
      logger.error('edit_date_room_select 처리 오류:', error);
      try {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('⚠️ 예약 조회 중 오류가 발생했습니다.'),
        });
      } catch {
        // 업데이트 실패 무시
      }
    }
  });

  // 2. 예약 선택 → 수정/취소 모달
  app.view('edit_booking_select', async ({ ack, view, body, client, logger }) => {
    await ack({
      response_action: 'update',
      view: buildProcessingView(),
    });

    try {
      const meta = JSON.parse(view.private_metadata ?? '{}') as { roomId?: string; date?: string };
      const roomId = meta.roomId ?? '';
      const dateStr = meta.date ?? '';

      const values = view.state.values;
      const eventId = values['booking_select_block']?.['booking_radio']?.selected_option?.value ?? '';
      const action = values['action_select_block']?.['action_radio']?.selected_option?.value ?? 'edit';

      if (!roomId || !eventId || !dateStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('예약 정보를 찾을 수 없습니다.'),
        });
        return;
      }

      const date = new Date(dateStr + 'T00:00:00');
      const events = await listRoomEvents(roomId, date);
      const booking = events.find(e => e.eventId === eventId);

      if (!booking) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('선택한 예약을 찾을 수 없습니다.'),
        });
        return;
      }

      // roomName 채우기
      const room = getRoomById(roomId);
      booking.roomName = room?.name ?? '';

      if (action === 'cancel') {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildCancelConfirmModal(booking),
        });
      } else {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildEditBookingModal(booking),
        });
      }
    } catch (error) {
      logger.error('edit_booking_select 처리 오류:', error);
      try {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('⚠️ 예약 정보를 불러오는 중 오류가 발생했습니다.'),
        });
      } catch {
        // 업데이트 실패 무시
      }
    }
  });

  // 3. 예약 수정 제출
  app.view('edit_booking_submit', async ({ ack, view, body, client, logger }) => {
    await ack({ response_action: 'clear' });

    try {
      const meta = JSON.parse(view.private_metadata ?? '{}') as { eventId?: string; roomId?: string; date?: string };
      const eventId = meta.eventId ?? '';
      const roomId = meta.roomId ?? '';
      const originalDateStr = meta.date ?? '';

      const values = view.state.values;
      const newSummary = values['title_block']?.['title_input']?.value ?? '';
      const newDateStr = values['date_block']?.['date_input']?.selected_date ?? '';
      const newStartTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value ?? '';
      const newEndTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value ?? '';

      const newStartTime = parseDateTimeString(newDateStr, newStartTimeStr);
      const newEndTime = parseDateTimeString(newDateStr, newEndTimeStr);

      // 기존 이벤트 조회
      const originalDate = new Date(originalDateStr + 'T00:00:00');
      const events = await listRoomEvents(roomId, originalDate);
      const oldBooking = events.find(e => e.eventId === eventId);

      // roomName 채우기
      const room = getRoomById(roomId);
      if (oldBooking) {
        oldBooking.roomName = room?.name ?? '';
      }

      // changes 구성
      const changes: BookingChanges = {};
      if (oldBooking) {
        if (oldBooking.summary !== newSummary) {
          changes.summary = { before: oldBooking.summary, after: newSummary };
        }
        if (oldBooking.startTime.getTime() !== newStartTime.getTime()) {
          changes.startTime = { before: oldBooking.startTime, after: newStartTime };
        }
        if (oldBooking.endTime.getTime() !== newEndTime.getTime()) {
          changes.endTime = { before: oldBooking.endTime, after: newEndTime };
        }
      }

      await updateBooking(eventId, roomId, {
        summary: newSummary,
        startTime: newStartTime,
        endTime: newEndTime,
      });

      if (oldBooking) {
        await sendChangeNotification(client, oldBooking, changes);
      }

      await client.chat.postMessage({
        channel: body.user.id,
        text: '✅ 예약이 수정되었습니다.',
      });
    } catch (error) {
      logger.error('edit_booking_submit 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '⚠️ 예약 수정 중 오류가 발생했습니다.';
      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ ${errorMessage}`,
      });
    }
  });

  // 4. 예약 취소 확인
  app.view('edit_cancel_confirm', async ({ ack, view, body, client, logger }) => {
    await ack({ response_action: 'clear' });

    try {
      const meta = JSON.parse(view.private_metadata ?? '{}') as { eventId?: string; roomId?: string; date?: string };
      const eventId = meta.eventId ?? '';
      const roomId = meta.roomId ?? '';
      const dateStr = meta.date ?? '';

      // 기존 이벤트 조회
      const date = new Date(dateStr + 'T00:00:00');
      const events = await listRoomEvents(roomId, date);
      const booking = events.find(e => e.eventId === eventId);

      // roomName 채우기
      if (booking) {
        const room = getRoomById(roomId);
        booking.roomName = room?.name ?? '';
      }

      await cancelBooking(eventId, roomId);

      if (booking) {
        await sendCancelNotification(client, booking);
      }

      await client.chat.postMessage({
        channel: body.user.id,
        text: '🗑️ 예약이 취소되었습니다.',
      });
    } catch (error) {
      logger.error('edit_cancel_confirm 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '⚠️ 예약 취소 중 오류가 발생했습니다.';
      await client.chat.postMessage({
        channel: body.user.id,
        text: `❌ ${errorMessage}`,
      });
    }
  });
}
