import { ROOMS } from '../config/rooms.js';

export function buildStatusModal(channelId?: string) {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const today = kstNow.toISOString().slice(0, 10);

  const roomOptions = ROOMS.map((room) => ({
    text: {
      type: 'plain_text' as const,
      text: `${room.type === 'meeting' ? '🏢' : '🎯'} ${room.name} (${room.capacity}인)`,
      emoji: true,
    },
    value: room.id,
  }));

  return {
    type: 'modal' as const,
    callback_id: 'status_modal',
    title: { type: 'plain_text' as const, text: '📊 예약 현황 조회', emoji: true },
    submit: { type: 'plain_text' as const, text: '조회', emoji: true },
    close: { type: 'plain_text' as const, text: '닫기', emoji: true },
    private_metadata: JSON.stringify({ channelId: channelId ?? '' }),
    blocks: [
      {
        type: 'input' as const,
        block_id: 'date_block',
        label: { type: 'plain_text' as const, text: '📅 날짜', emoji: true },
        element: {
          type: 'datepicker' as const,
          action_id: 'date_input',
          initial_date: today,
          placeholder: { type: 'plain_text' as const, text: '날짜 선택', emoji: false },
        },
      },
      {
        type: 'input' as const,
        block_id: 'room_block',
        label: { type: 'plain_text' as const, text: '🏠 회의실', emoji: true },
        element: {
          type: 'static_select' as const,
          action_id: 'room_input',
          initial_option: {
            text: { type: 'plain_text' as const, text: '📋 전체 회의실', emoji: true },
            value: 'all',
          },
          options: [
            {
              text: { type: 'plain_text' as const, text: '📋 전체 회의실', emoji: true },
              value: 'all',
            },
            ...roomOptions,
          ],
        },
      },
    ],
  };
}
