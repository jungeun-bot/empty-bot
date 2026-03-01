import type { App } from '@slack/bolt';
import { getAvailableRooms, createBooking } from '../../services/calendar.js';
import { getRoomsByType } from '../../config/rooms.js';
import { selectBestRoom } from '../../services/conversation.js';
import type { BookingRequest, Attendee } from '../../types/index.js';

export function registerBookRoomFunction(app: App): void {
  app.function('book_room', async ({ inputs, complete, fail, client, logger }) => {
    try {
      // inputs에서 파라미터 추출
      const startTimeStr = inputs['start_time'] as string;
      const endTimeStr = inputs['end_time'] as string;
      const capacity = Number(inputs['capacity'] ?? 1);
      const title = (inputs['title'] as string) || '회의실 예약';
      const organizerEmail = (inputs['organizer_email'] as string) || '';
      const attendeeEmails = ((inputs['attendee_emails'] as string) || '').split(',').map(e => e.trim()).filter(Boolean);
      const roomType = (inputs['room_type'] as string) === 'focusing' ? 'focusing' : 'meeting';

      const startTime = new Date(startTimeStr);
      const endTime = new Date(endTimeStr);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        await fail({ error: '유효하지 않은 시간 형식입니다.' });
        return;
      }

      const availableRooms = await getAvailableRooms(startTime, endTime, capacity);
      const selectedRoom = selectBestRoom(availableRooms, capacity, roomType as 'meeting' | 'focusing');

      if (!selectedRoom) {
        await fail({ error: '해당 시간대에 조건에 맞는 예약 가능한 회의실이 없습니다.' });
        return;
      }

      const attendees: Attendee[] = attendeeEmails.map(email => ({ email, name: email }));

      const bookingRequest: BookingRequest = {
        room: selectedRoom,
        startTime,
        endTime,
        title,
        attendees,
        organizer: organizerEmail,
      };

      const eventId = await createBooking(bookingRequest);

      await complete({
        outputs: {
          event_id: eventId,
          room_name: selectedRoom.name,
          room_id: selectedRoom.id,
        },
      });
    } catch (error) {
      logger.error('book_room function 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '예약 처리 중 오류가 발생했습니다.' });
    }
  });
}
