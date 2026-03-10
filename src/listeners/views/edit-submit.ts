import type { App } from '@slack/bolt';
import { listUserBookings, getUserEvent, updateBooking, cancelBooking } from '../../services/calendar.js';
import { sendChangeNotification, sendCancelNotification } from '../../services/notification.js';
import type { BookingChanges } from '../../services/notification.js';
import { buildBookingListModal, buildEditBookingModal, buildCancelConfirmModal } from '../../views/edit-modal.js';
import { buildProcessingView, buildErrorView } from '../../views/result-views.js';
import { parseDateTimeString } from '../../views/common.js';
import { getRoomById } from '../../config/rooms.js';
import type { BookingEvent } from '../../types/index.js';
import { logCancelToSheet, logEditToSheet } from '../../services/sheets-log.js';
import { env, BOT_DISPLAY_NAME } from '../../config/env.js';

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
      // metadata에서 channelId 추출
      let channelId = '';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as { channelId?: string };
        channelId = meta.channelId ?? '';
      } catch { /* 무시 */ }

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

      // 사용자의 primary calendar에서 미팅룸 예약 조회
      let myBookings: BookingEvent[] = [];
      try {
        myBookings = await listUserBookings(organizerEmail, date);
        myBookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      } catch (calError) {
        logger.error(`[/수정] listUserBookings 실패 (email=${organizerEmail}):`, calError);
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView(`⚠️ 예약 조회 실패: ${calError instanceof Error ? calError.message : '알 수 없는 오류'}`),
        });
        return;
      }

      logger.info(`[/수정 v4] 예약자: ${organizerEmail}, 조회된 예약: ${myBookings.length}건`);
      for (const b of myBookings) {
        logger.info(`  - [${b.roomName}] ${b.summary} | room=${b.roomId}`);
      }

      if (myBookings.length === 0) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView(`해당 날짜에 수정 가능한 예약이 없습니다.\n(조회 계정: ${organizerEmail})\n(버전: v4-no-resource-filter)`),
        });
        return;
      }

      await client.views.update({
        view_id: body.view?.id ?? '',
        view: buildBookingListModal(myBookings, channelId),
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
      // metadata에서 channelId 추출
      let channelId = '';
      try {
        const meta0 = JSON.parse(view.private_metadata ?? '{}') as { channelId?: string };
        channelId = meta0.channelId ?? '';
      } catch { /* 무시 */ }

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
          view: buildCancelConfirmModal(booking, channelId),
        });
      } else {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildEditBookingModal(booking, channelId),
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
    const parsedMeta = JSON.parse(view.private_metadata ?? '{}') as { eventId?: string; roomId?: string; date?: string; channelId?: string };
    const channelId = parsedMeta.channelId ?? '';

    try {
      const eventId = parsedMeta.eventId ?? '';
      const oldRoomId = parsedMeta.roomId ?? '';

      const values = view.state.values;
      const newSummary = values['title_block']?.['title_input']?.value ?? '';
      const newRoomId = values['room_block']?.['room_input']?.selected_option?.value ?? oldRoomId;
      const newDateStr = values['date_block']?.['date_input']?.selected_date ?? '';
      const newStartTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value ?? '';
      const newEndTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value ?? '';

      const newStartTime = parseDateTimeString(newDateStr, newStartTimeStr);
      const newEndTime = parseDateTimeString(newDateStr, newEndTimeStr);

      // 참석자 파싱 (group: 접두어로 그룹/개인 구분 — book-submit.ts와 동일 패턴)
      const selectedOptions = values['attendees_block']?.['attendees_input']?.selected_options ?? [];
      const groupSelections = selectedOptions.filter((opt: { value: string }) => opt.value.startsWith('group:'));
      const userSelections = selectedOptions.filter((opt: { value: string }) => !opt.value.startsWith('group:'));

      // 그룹 멤버 이메일 해석
      const groupEmails: string[] = [];
      for (const group of groupSelections) {
        const groupId = group.value.replace('group:', '');
        try {
          const membersResult = await client.usergroups.users.list({ usergroup: groupId });
          const memberIds = membersResult.users ?? [];
          const memberInfos = await Promise.all(
            memberIds.map(async (uid: string) => {
              try {
                const info = await client.users.info({ user: uid });
                return info.user?.profile?.email ?? '';
              } catch { return ''; }
            }),
          );
          for (const email of memberInfos) {
            if (email) groupEmails.push(email);
          }
        } catch {
          // 그룹 멤버 조회 실패 시 스킵
        }
      }

      const individualEmails = userSelections.map((opt: { value: string }) => opt.value);

      // 사용자의 primary calendar에서 기존 이벤트 조회
      const organizerEmail = await resolveUserEmail(client, body.user.id);
      const oldBooking = await getUserEvent(organizerEmail, eventId);

      if (!oldBooking) {
        await client.chat.postMessage({
          channel: channelId || body.user.id,
          text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 수정 또는 삭제되었을 수 있습니다.',
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      if (!oldBooking.roomId && oldRoomId) {
        oldBooking.roomId = oldRoomId;
        const room = getRoomById(oldRoomId);
        oldBooking.roomName = room?.name ?? '';
      }

      // 참석자 중복 제거 (예약자 제외)
      const newPersonAttendees = [...new Set([...groupEmails, ...individualEmails])]
        .filter(email => email && email !== organizerEmail);

      // 관리자 캘린더에서 모든 회의 확인 가능하도록 포함
      // 캘린더 업데이트용 전체 참석자 리스트 (사람 + 회의실 + 예약자)
      const fullAttendees = [...new Set([...newPersonAttendees, newRoomId, organizerEmail, env.google.adminEmail])]
        .filter(Boolean);

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
      if (oldRoomId !== newRoomId) {
        const oldRoom = getRoomById(oldRoomId);
        const newRoom = getRoomById(newRoomId);
        changes.room = { before: oldRoom?.name ?? '', after: newRoom?.name ?? '' };
      }
      const oldPersonAttendees = oldBooking.attendees
        .filter(e => !e.includes('@resource.calendar.google.com') && e !== organizerEmail)
        .sort();
      const sortedNewPerson = [...newPersonAttendees].sort();
      if (JSON.stringify(oldPersonAttendees) !== JSON.stringify(sortedNewPerson)) {
        changes.attendees = { before: oldPersonAttendees, after: newPersonAttendees };
      }

      // user의 primary calendar에서 직접 수정
      await updateBooking(eventId, newRoomId, {
        summary: newSummary,
        startTime: newStartTime,
        endTime: newEndTime,
        attendees: fullAttendees,
      }, organizerEmail);

      await sendChangeNotification(client, oldBooking, changes);

      // 시트 기록 (비동기, 실패해도 수정에 영향 없음)
      const editRoom = getRoomById(newRoomId);
      logEditToSheet(
        organizerEmail,
        editRoom?.name || '',
        eventId,
        newSummary,
        newStartTime,
        newEndTime,
        newPersonAttendees,
      ).catch(() => {});

      await client.chat.postMessage({
        channel: channelId || body.user.id,
        text: '✅ 예약이 수정되었습니다.',
        username: BOT_DISPLAY_NAME,
      });
    } catch (error) {
      logger.error('edit_booking_submit 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '⚠️ 예약 수정 중 오류가 발생했습니다.';
      await client.chat.postMessage({
          channel: channelId || body.user.id,
        text: `❌ ${errorMessage}`,
        username: BOT_DISPLAY_NAME,
      });
    }
  });

  // 4. 예약 취소 확인
  app.view('edit_cancel_confirm', async ({ ack, view, body, client, logger }) => {
    await ack({ response_action: 'clear' });
    const parsedMeta = JSON.parse(view.private_metadata ?? '{}') as { eventId?: string; roomId?: string; date?: string; channelId?: string };
    const channelId = parsedMeta.channelId ?? '';

    try {
      const eventId = parsedMeta.eventId ?? '';
      const roomId = parsedMeta.roomId ?? '';

      // 사용자의 primary calendar에서 기존 이벤트 조회
      const organizerEmail = await resolveUserEmail(client, body.user.id);
      const booking = await getUserEvent(organizerEmail, eventId);

      if (!booking) {
        await client.chat.postMessage({
          channel: channelId || body.user.id,
          text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.',
          username: BOT_DISPLAY_NAME,
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

      // 시트 기록 (비동기, 실패해도 취소에 영향 없음)
      logCancelToSheet(organizerEmail, booking).catch(() => {});

      await client.chat.postMessage({
          channel: channelId || body.user.id,
        text: '🗑️ 예약이 취소되었습니다.',
        username: BOT_DISPLAY_NAME,
      });
    } catch (error) {
      logger.error('edit_cancel_confirm 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '⚠️ 예약 취소 중 오류가 발생했습니다.';
      await client.chat.postMessage({
          channel: channelId || body.user.id,
        text: `❌ ${errorMessage}`,
        username: BOT_DISPLAY_NAME,
      });
    }
  });
}
