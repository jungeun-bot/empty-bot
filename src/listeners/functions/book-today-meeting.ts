import type { App } from '@slack/bolt';
import { getAvailableRooms, createBooking } from '../../services/calendar.js';
import { selectBestRoom } from '../../services/conversation.js';
import { formatDateTime } from '../../views/common.js';
import type { BookingRequest, Attendee } from '../../types/index.js';
import { BOT_DISPLAY_NAME } from '../../config/env.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 정기 회의 자동 예약용 함수 (워크플로 빌더 전용)
 *
 * 기존 book_room은 ISO datetime 문자열이 필요하지만,
 * 워크플로 빌더의 스케줄 트리거에서는 날짜 계산이 불가능하다.
 *
 * 이 함수는 "오늘 10:00~11:00" 형태로 입력받아
 * KST 기준 오늘 날짜를 자동으로 계산한 뒤 예약한다.
 */
export function registerBookTodayMeetingFunction(app: App): void {
  app.function('book_today_meeting', async ({ inputs, complete, fail, client, logger }) => {
    try {
      // ── 입력 파라미터 추출 ──
      const startHour = inputs['start_hour'] as string;   // "10:00"
      const endHour = inputs['end_hour'] as string;       // "11:00"
      const capacity = Number(inputs['capacity'] ?? 1);
      const title = (inputs['title'] as string) || '정기 미팅';
      const organizerEmail = inputs['organizer_email'] as string;
      const attendeeEmailsRaw = (inputs['attendee_emails'] as string) || '';
      const roomType = (inputs['room_type'] as string) === 'focus' ? 'focus' : 'meeting';
      const notifyChannel = (inputs['notify_channel'] as string) || '';
      const repeatUntil = (inputs['repeat_until'] as string) || '';  // "2025-12-31"

      if (!organizerEmail) {
        await fail({ error: 'organizer_email은 필수입니다.' });
        return;
      }

      // ── 반복 종료일 확인 ──
      const now = new Date();
      const kst = new Date(now.getTime() + KST_OFFSET_MS);
      const year = kst.getUTCFullYear();
      const month = kst.getUTCMonth();
      const day = kst.getUTCDate();

      if (repeatUntil) {
        const [untilY, untilM, untilD] = repeatUntil.split('-').map(Number);
        if (untilY && untilM && untilD) {
          const todayNum = year * 10000 + (month + 1) * 100 + day;
          const untilNum = untilY * 10000 + untilM * 100 + untilD;
          if (todayNum > untilNum) {
            const skipMsg = `⏹️ 정기 회의 "${title}"의 반복 기간이 종료되었습니다. (종료일: ${repeatUntil})\n이 워크플로를 비활성화해주세요.`;
            if (notifyChannel) {
              await client.chat.postMessage({ channel: notifyChannel, text: skipMsg, username: BOT_DISPLAY_NAME });
            }
            await complete({ outputs: { event_id: '', room_name: '', message: skipMsg } });
            return;
          }
        }
      }

      // ── KST 기준 오늘 날짜 + 시/분 → UTC Date 변환 ──
      const [startH, startM] = startHour.split(':').map(Number);
      const [endH, endM] = endHour.split(':').map(Number);

      if ([startH, startM, endH, endM].some(v => v === undefined || isNaN(v!))) {
        await fail({ error: '시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력하세요. (예: 10:00)' });
        return;
      }

      // KST 시간 → UTC Date
      const startTime = new Date(Date.UTC(year, month, day, startH!, startM!, 0, 0) - KST_OFFSET_MS);
      const endTime = new Date(Date.UTC(year, month, day, endH!, endM!, 0, 0) - KST_OFFSET_MS);

      if (endTime <= startTime) {
        await fail({ error: '종료 시간이 시작 시간보다 이후여야 합니다.' });
        return;
      }

      // ── 참석자 이메일 파싱 ──
      const attendees: Attendee[] = attendeeEmailsRaw
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
        .map(email => ({ email, name: email.split('@')[0] }));

      // ── 가용 미팅룸 조회 + 자동 선택 ──
      const availableRooms = await getAvailableRooms(startTime, endTime, capacity);
      const selectedRoom = selectBestRoom(availableRooms, capacity, roomType as 'meeting' | 'focus');

      if (!selectedRoom) {
        const errorMsg = `😔 ${formatDateTime(startTime)}에 ${capacity}인 이상 수용 가능한 빈 ${roomType === 'focus' ? '포커스룸' : '미팅룸'}이 없습니다.`;

        // 채널 알림 (실패)
        if (notifyChannel) {
          await client.chat.postMessage({
            channel: notifyChannel,
            text: `⚠️ 정기 회의 자동 예약 실패\n*회의:* ${title}\n${errorMsg}`,
            username: BOT_DISPLAY_NAME,
          });
        }

        await fail({ error: errorMsg });
        return;
      }

      // ── 예약 생성 ──
      const bookingRequest: BookingRequest = {
        room: selectedRoom,
        startTime,
        endTime,
        title,
        attendees,
        organizer: organizerEmail,
        organizerName: organizerEmail.split('@')[0],
      };

      const eventId = await createBooking(bookingRequest);

      const allNames: string[] = [organizerEmail.split('@')[0]];
      allNames.push(...attendees.map(a => a.name));
      const attendeeNames = allNames.length > 0 ? allNames.join(', ') : '없음';

      const successMsg = `✅ *정기 회의가 자동 예약되었습니다!*\n*회의:* ${title}\n*미팅룸:* ${selectedRoom.name} (최대 ${selectedRoom.capacity}인)\n*일시:* ${formatDateTime(startTime)} ~ ${formatDateTime(endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`;

      // ── 채널 알림 (성공) ──
      if (notifyChannel) {
        await client.chat.postMessage({
          channel: notifyChannel,
          text: successMsg,
          username: BOT_DISPLAY_NAME,
        });
      }

      await complete({
        outputs: {
          event_id: eventId,
          room_name: selectedRoom.name,
          message: successMsg,
        },
      });
    } catch (error) {
      logger.error('book_today_meeting function 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '정기 회의 예약 중 오류가 발생했습니다.' });
    }
  });
}
