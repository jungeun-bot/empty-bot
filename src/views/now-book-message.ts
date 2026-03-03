import type { Room } from '../types/index.js';
import { formatDateTime } from './common.js';

export interface RoomWithAvailability {
  room: Room;
  availableUntil: Date | null;
}

export function buildNowBookMessage(
  rooms: RoomWithAvailability[],
  bookingId: string,
): object[] {
  const now = new Date();

  const blocks: object[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🏢 지금 바로 사용 가능한 미팅룸*\n현재 시각: ${formatDateTime(now)}`,
      },
    },
    { type: 'divider' },
  ];

  for (const { room, availableUntil } of rooms) {
    const availabilityText = availableUntil
      ? `지금부터 *${String(availableUntil.getHours()).padStart(2, '0')}:${String(availableUntil.getMinutes()).padStart(2, '0')}*까지 사용 가능`
      : '오늘 종일 사용 가능';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${room.name}* (최대 ${room.capacity}인)\n${availabilityText}`,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '예약하기',
          emoji: true,
        },
        action_id: 'select_room_now',
        value: JSON.stringify({ bookingId, roomId: room.id }),
        style: 'primary',
      },
    });
  }

  return blocks;
}
