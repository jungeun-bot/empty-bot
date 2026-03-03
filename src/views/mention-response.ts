import type { Room } from '../types/index.js';
import { formatDateTime } from './common.js';

export interface RoomWithAvailability {
  room: Room;
  availableUntil: Date | null;
}

/**
 * 멘션 응답 메시지 빌드
 * 사용 가능한 미팅룸 목록을 표시
 */
export function buildMentionResponse(
  rooms: RoomWithAvailability[],
  bookingId: string,
  parsedTime: Date,
  capacity: number | null,
): object[] {
  const capacityText = capacity ? ` ${capacity}인 이상` : '';
  const headerText = capacity
    ? `🏢 *${formatDateTime(parsedTime)} 기준 ${capacity}인 이상 사용 가능한 미팅룸*`
    : `🏢 *${formatDateTime(parsedTime)} 기준 사용 가능한 미팅룸*`;

  const blocks: object[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: headerText,
      },
    },
    { type: 'divider' },
  ];

  for (const { room, availableUntil } of rooms) {
    const availabilityText = availableUntil
      ? `~${String(availableUntil.getHours()).padStart(2, '0')}:${String(availableUntil.getMinutes()).padStart(2, '0')}까지 사용 가능`
      : '종일 사용 가능';

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

/**
 * 사용 가능한 미팅룸이 없을 때의 응답 메시지
 */
export function buildNoRoomResponse(
  parsedTime: Date,
  capacity: number | null,
): object[] {
  const capacityText = capacity ? `(${capacity}인 이상 수용 가능한 미팅룸 기준)` : '';
  const text = `😔 ${formatDateTime(parsedTime)} 기준으로 조건에 맞는 빈 미팅룸이 없습니다.${capacity ? ` ${capacityText}` : ''}`;

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    },
  ];
}

/**
 * 시간 파싱 오류 응답 메시지
 */
export function buildTimeErrorResponse(message: string): object[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ ${message}`,
      },
    },
  ];
}
