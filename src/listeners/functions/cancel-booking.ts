import type { App } from '@slack/bolt';
import { cancelBooking } from '../../services/calendar.js';

export function registerCancelBookingFunction(app: App): void {
  app.function('cancel_booking', async ({ inputs, complete, fail, logger }) => {
    try {
      const eventId = inputs['event_id'] as string;
      const roomId = inputs['room_id'] as string;

      if (!eventId || !roomId) {
        await fail({ error: 'event_id와 room_id는 필수입니다.' });
        return;
      }

      await cancelBooking(eventId, roomId);

      await complete({
        outputs: {
          success: true,
          event_id: eventId,
        },
      });
    } catch (error) {
      logger.error('cancel_booking function 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '예약 취소 중 오류가 발생했습니다.' });
    }
  });
}
