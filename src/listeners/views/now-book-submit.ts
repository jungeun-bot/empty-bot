import type { App } from '@slack/bolt';
import type { Attendee, BookingRequest } from '../../types/index.js';
import { createBooking } from '../../services/calendar.js';
import { getRoomById } from '../../config/rooms.js';
import { formatDateTime } from '../../views/common.js';
import { pendingBookings } from './book-submit.js';
import { BOT_DISPLAY_NAME } from '../../config/env.js';

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
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      const booking = pendingBookings.get(bookingId);
      if (!booking) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⏰ 예약 세션이 만료되었습니다. `/즉시예약`을 다시 실행해주세요.',
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      const room = getRoomById(roomId);
      if (!room) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: '⚠️ 선택한 미팅룸을 찾을 수 없습니다.',
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      // 사용 시간(분) 추출
      const durationStr = view.state.values['duration_block']?.['duration_input']?.selected_option?.value;
      const durationMinutes = parseInt(durationStr ?? '60', 10);

      const meetingTitle = view.state.values['title_block']?.['title_input']?.value ?? '';

      // 예약자 이메일 조회 (중복 제거용)
      let organizerEmail = '';
      try {
        const userInfo = await client.users.info({ user: body.user.id });
        organizerEmail = userInfo.user?.profile?.email ?? '';
      } catch {
        // 이메일 조회 실패 시 빈 문자열
      }

      // 참석자/사용자그룹 선택 파싱 (group: 접두어로 구분)
      const selectedOptions = view.state.values['attendees_block']?.['attendees_input']?.selected_options ?? [];
      const groupSelections = selectedOptions.filter((opt) => opt.value.startsWith('group:'));
      const userSelections = selectedOptions.filter((opt) => !opt.value.startsWith('group:'));

      // 1. 사용자그룹 멤버 조회
      const groupAttendees: Attendee[] = [];

      for (const group of groupSelections) {
        const groupId = group.value.replace('group:', '');
        try {
          const membersResult = await client.usergroups.users.list({ usergroup: groupId });
          const memberIds = membersResult.users ?? [];

          const memberInfos = await Promise.all(
            memberIds.map(async (userId) => {
              try {
                const info = await client.users.info({ user: userId });
                const email = info.user?.profile?.email;
                const name = info.user?.profile?.real_name ?? info.user?.name ?? '';
                if (email) return { name, email };
              } catch {
                // 개별 사용자 조회 실패 시 스킵
              }
              return null;
            }),
          );

          for (const info of memberInfos) {
            if (info) groupAttendees.push(info);
          }
        } catch {
          // 그룹 멤버 조회 실패 시 스킵
        }
      }

      // 2. 개별 선택 참석자
      const individualAttendees: Attendee[] = userSelections.map((opt) => ({
        name: opt.text.text,
        email: opt.value,
      }));

      // 3. 외부 게스트 이메일 파싱 (쉼표 또는 줄바꿈 구분)
      const guestEmailsRaw = view.state.values['guest_emails_block']?.['guest_emails_input']?.value ?? '';
      const guestAttendees: Attendee[] = guestEmailsRaw
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'))
        .map((email) => ({ name: email.split('@')[0], email }));

      // 4. 합산 + 중복 제거 (이메일 기준, 예약자 본인 제외)
      const allCandidates = [...groupAttendees, ...individualAttendees, ...guestAttendees];
      const uniqueEmails = new Set<string>();
      const modalAttendees: Attendee[] = [];

      for (const a of allCandidates) {
        if (a.email !== organizerEmail && !uniqueEmails.has(a.email)) {
          uniqueEmails.add(a.email);
          modalAttendees.push(a);
        }
      }

      // 참석자 수 + 본인(예약자) = 총 인원

      const startTime = booking.startTime;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      const bookingRequest: BookingRequest = {
        room,
        startTime,
        endTime,
        title: meetingTitle || `[미팅룸 예약] ${room.name}`,
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
        text: `✅ *예약 완료!*\n*회의 이름:* ${meetingTitle || '(없음)'}\n*미팅룸:* ${room.name} (최대 ${room.capacity}인)\n*일시:* ${formatDateTime(startTime)} ~ ${formatDateTime(endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`,
        username: BOT_DISPLAY_NAME,
      });
    } catch (error) {
      logger.error('now_book_end_time 제출 처리 오류:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : '⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      try {
        await client.chat.postMessage({ channel: body.user.id, text: `❌ ${errorMessage}`, username: BOT_DISPLAY_NAME });
      } catch {
        // 메시지 전송 실패 무시
      }
    }
  });
}
