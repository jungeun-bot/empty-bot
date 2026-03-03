import type { App } from '@slack/bolt';
import { updateBooking } from '../../services/calendar.js';

export function registerEditBookingFunction(app: App): void {
  app.function('edit_booking', async ({ inputs, complete, fail, logger }) => {
    try {
      const eventId = inputs['event_id'] as string;
      const roomId = inputs['room_id'] as string;
      const newTitle = inputs['new_title'] as string | undefined;
      const newStartTimeStr = inputs['new_start_time'] as string | undefined;
      const newEndTimeStr = inputs['new_end_time'] as string | undefined;

      if (!eventId || !roomId) {
        await fail({ error: 'event_id와 room_id는 필수입니다.' });
        return;
      }

      const updates: { summary?: string; startTime?: Date; endTime?: Date } = {};
      if (newTitle) updates.summary = newTitle;
      if (newStartTimeStr) {
        const d = new Date(newStartTimeStr);
        if (!isNaN(d.getTime())) updates.startTime = d;
      }
      if (newEndTimeStr) {
        const d = new Date(newEndTimeStr);
        if (!isNaN(d.getTime())) updates.endTime = d;
      }

      await updateBooking(eventId, roomId, updates);

      await complete({
        outputs: {
          success: true,
          event_id: eventId,
        },
      });
    } catch (error) {
      logger.error('edit_booking function 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.' });
    }
  });
}
