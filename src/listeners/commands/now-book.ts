import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { PendingBooking } from '../../types/index.js';
import { getAvailableRooms, getRoomAvailableUntil } from '../../services/calendar.js';
import { buildNowBookMessage } from '../../views/now-book-message.js';
import { pendingBookings } from '../views/book-submit.js';

function generateBookingId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function registerNowBookCommand(app: App): void {
  app.command('/now-book', async ({ command, ack, respond, logger }) => {
    await ack();

    // 인원수 파싱
    const capacityStr = command.text.trim();
    const capacity = parseInt(capacityStr, 10);

    if (!capacityStr || isNaN(capacity) || capacity < 1 || capacity > 50) {
      await respond({
        response_type: 'ephemeral',
        text: '❌ 함께 사용할 인원수를 입력해주세요.\n예: `/now-book 4`',
      });
      return;
    }

    try {
      const now = new Date();
      // 현재 시각부터 30분 후까지 최소 가용성 확인
      const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000);

      // 가용 회의실 조회
      const availableRooms = await getAvailableRooms(now, thirtyMinLater, capacity);

      if (availableRooms.length === 0) {
        await respond({
          response_type: 'ephemeral',
          text: `😔 현재 ${capacity}인 이상 수용 가능한 빈 회의실이 없습니다.`,
        });
        return;
      }

      // 각 회의실의 가용 시간 조회
      const roomsWithAvailability = await Promise.all(
        availableRooms.map(async (room) => ({
          room,
          availableUntil: await getRoomAvailableUntil(room, now),
        })),
      );

      // 예약 상태 저장
      const bookingId = generateBookingId();
      const booking: PendingBooking = {
        id: bookingId,
        startTime: now,
        capacity,
        attendees: [],
        channelId: command.channel_id,
        userId: command.user_id,
      };
      pendingBookings.set(bookingId, booking);

      // 5분 후 자동 만료
      setTimeout(() => {
        pendingBookings.delete(bookingId);
      }, 5 * 60 * 1000);

      await respond({
        response_type: 'ephemeral',
        blocks: buildNowBookMessage(roomsWithAvailability, bookingId) as KnownBlock[],
      });
    } catch (error) {
      logger.error('/now-book 처리 오류:', error);
      await respond({
        response_type: 'ephemeral',
        text: '⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }
  });
}
