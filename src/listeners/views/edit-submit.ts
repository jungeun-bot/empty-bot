import type { App } from '@slack/bolt';
import { listUserBookings, getUserEvent, updateBooking, cancelBooking } from '../../services/calendar.js';
import { sendChangeNotification, sendCancelNotification } from '../../services/notification.js';
import type { BookingChanges } from '../../services/notification.js';
import { buildBookingListModal, buildEditBookingModal, buildCancelConfirmModal } from '../../views/edit-modal.js';
import { buildProcessingView, buildErrorView } from '../../views/result-views.js';
import { parseDateTimeString } from '../../views/common.js';
import { getRoomById } from '../../config/rooms.js';
import type { BookingEvent } from '../../types/index.js';

/** Slack 사용자 이메일 조회 헬퍼 */
async function resolveUserEmail(
  client: Parameters<Parameters<App['view']>[1]>[0]['client'],
  userId: string,
): Promise<string> {
  const userInfo = await client.users.info({ user: userId });
  return userInfo.user?.profile?.email ?? '';
}

export function registerEditSubmit(app: App): void {
  // 1. 날짜 선택 → 사용자의 primary calendar에서 봇 예약 조회
  app.view('edit_date_room_select', async ({ ack, view, body, client, logger }) => {
    await ack({
      response_action: 'update',
      view: buildProcessingView(),
    });

    try {
      const values = view.state.values;
      const dateStr = values['date_block']?.['date_input']?.selected_date;

      if (!dateStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('날짜를 선택해주세요.'),
        });
        return;
      }

      // 예약자 이메일 조회
      let organizerEmail = '';
      try {
        organizerEmail = await resolveUserEmail(client, body.user.id);
      } catch (emailError) {
        logger.error('사용자 이메일 조회 실패:', emailError);
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('⚠️ 사용자 정보를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.'),
        });
        return;
      }

      const date = new Date(dateStr + 'T00:00:00+09:00');

      // 사용자의 primary calendar에서 봇이 생성한 예약만 조회
      const myBookings = await listUserBookings(organizerEmail, date);
      myBookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      logger.info(`[/수정] 예약자: ${organizerEmail}, 조회된 예약: ${myBookings.length}건`);
      for (const b of myBookings) {
        logger.info(`  - [${b.roomName}] ${b.summary} | room=${b.roomId}`);
      }

      if (myBookings.length === 0) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('해당 날짜에 수정 가능한 예약이 없습니다.'),
        });
        return;
      }

      await client.views.update({
        view_id: body.view?.id ?? '',
        view: buildBookingListModal(myBookings),
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
      const values = view.state.values;
      const selectedValue = values['booking_select_block']?.['booking_radio']?.selected_option?.value ?? '';
      const [roomId = '', eventId = ''] = selectedValue.split('::');
      const action = values['action_select_block']?.['action_radio']?.selected_option?.value ?? 'edit';

      if (!eventId) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('예약 정보를 찾을 수 없습니다.'),
        });
        return;
      }

      // 사용자의 primary calendar에서 이벤트 직접 조회
      const organizerEmail = await resolveUserEmail(client, body.user.id);
      const booking = await getUserEvent(organizerEmail, eventId);

      if (!booking) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('선택한 예약을 찾을 수 없습니다.'),
        });
        return;
      }

      // roomId가 없는 경우 선택값에서 보완
      if (!booking.roomId && roomId) {
        booking.roomId = roomId;
        const room = getRoomById(roomId);
        booking.roomName = room?.name ?? '';
      }

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

      const values = view.state.values;
      const newSummary = values['title_block']?.['title_input']?.value ?? '';
      const newDateStr = values['date_block']?.['date_input']?.selected_date ?? '';
      const newStartTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value ?? '';
      const newEndTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value ?? '';

      const newStartTime = parseDateTimeString(newDateStr, newStartTimeStr);
      const newEndTime = parseDateTimeString(newDateStr, newEndTimeStr);

      // 사용자의 primary calendar에서 기존 이벤트 조회
      const organizerEmail = await resolveUserEmail(client, body.user.id);
      const oldBooking = await getUserEvent(organizerEmail, eventId);

      if (!oldBooking) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 수정 또는 삭제되었을 수 있습니다.',
        });
        return;
      }

      if (!oldBooking.roomId && roomId) {
        oldBooking.roomId = roomId;
        const room = getRoomById(roomId);
        oldBooking.roomName = room?.name ?? '';
      }

      // changes 구성
      const changes: BookingChanges = {};
      if (oldBooking.summary !== newSummary) {
        changes.summary = { before: oldBooking.summary, after: newSummary };
      }
      if (oldBooking.startTime.getTime() !== newStartTime.getTime()) {
        changes.startTime = { before: oldBooking.startTime, after: newStartTime };
      }
      if (oldBooking.endTime.getTime() !== newEndTime.getTime()) {
        changes.endTime = { before: oldBooking.endTime, after: newEndTime };
      }

      // user의 primary calendar에서 직접 수정
      await updateBooking(eventId, roomId, {
        summary: newSummary,
        startTime: newStartTime,
        endTime: newEndTime,
      }, organizerEmail);

      await sendChangeNotification(client, oldBooking, changes);

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

      // 사용자의 primary calendar에서 기존 이벤트 조회
      const organizerEmail = await resolveUserEmail(client, body.user.id);
      const booking = await getUserEvent(organizerEmail, eventId);

      if (!booking) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.',
        });
        return;
      }

      if (!booking.roomId && roomId) {
        booking.roomId = roomId;
        const room = getRoomById(roomId);
        booking.roomName = room?.name ?? '';
      }

      // user의 primary calendar에서 직접 삭제
      await cancelBooking(eventId, roomId, organizerEmail);

      await sendCancelNotification(client, booking);

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
