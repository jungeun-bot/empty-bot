import type { Room, Attendee } from '../types/index.js';
import { formatDateTime, formatTimeRange } from './common.js';

export function buildRoomSelectMessage(
  rooms: Room[],
  bookingId: string,
): object[] {
  const blocks: object[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🏢 예약 가능한 회의실*\n아래 목록에서 회의실을 선택하세요:',
      },
    },
    { type: 'divider' },
  ];

  for (const room of rooms) {

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${room.name}* (최대 ${room.capacity}인)`,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '선택',
          emoji: true,
        },
        action_id: 'select_room',
        value: JSON.stringify({ bookingId, roomId: room.id }),
        style: 'primary',
      },
    });
  }

  return blocks;
}

export function buildSuccessView(
  room: Room,
  startTime: Date,
  endTime: Date,
  attendees: Attendee[],
) {
  const attendeeNames =
    attendees.length > 0
      ? attendees.map((a) => a.name).join(', ')
      : '없음';

  return {
    type: 'modal' as const,
    title: {
      type: 'plain_text' as const,
      text: '예약 완료',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *예약이 완료되었습니다!*\n\n*회의실:* ${room.name}\n*일시:* ${formatDateTime(startTime)}\n*시간:* ${formatTimeRange(startTime, endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 참석자에게 발송되었습니다.`,
        },
      },
    ],
  };
}

export function buildErrorView(message: string) {
  return {
    type: 'modal' as const,
    title: {
      type: 'plain_text' as const,
      text: '예약 실패',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ ${message}`,
        },
      },
    ],
  };
}

export function buildProcessingView() {
  return {
    type: 'modal' as const,
    title: {
      type: 'plain_text' as const,
      text: '처리 중',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏳ 예약을 처리하고 있습니다...\n잠시만 기다려주세요.',
        },
      },
    ],
  };
}

export function buildEndTimeModal(
  room: Room,
  availableUntil: Date | null,
  bookingId: string,
) {
  const availabilityNote = availableUntil
    ? `이 회의실은 ${String(availableUntil.getHours()).padStart(2, '0')}:${String(availableUntil.getMinutes()).padStart(2, '0')}까지 사용 가능합니다.`
    : '이 회의실은 오늘 종일 사용 가능합니다.';

  const durationOptions = [
    { text: { type: 'plain_text' as const, text: '30분', emoji: false }, value: '30' },
    { text: { type: 'plain_text' as const, text: '1시간', emoji: false }, value: '60' },
    { text: { type: 'plain_text' as const, text: '1시간 30분', emoji: false }, value: '90' },
    { text: { type: 'plain_text' as const, text: '2시간', emoji: false }, value: '120' },
    { text: { type: 'plain_text' as const, text: '2시간 30분', emoji: false }, value: '150' },
    { text: { type: 'plain_text' as const, text: '3시간', emoji: false }, value: '180' },
  ];

  return {
    type: 'modal' as const,
    callback_id: 'now_book_end_time',
    private_metadata: JSON.stringify({ bookingId, roomId: room.id }),
    title: {
      type: 'plain_text' as const,
      text: '사용 시간 선택',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '예약 확정',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '취소',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${room.name}* (최대 ${room.capacity}인)\n${availabilityNote}`,
        },
      },
      {
        type: 'input' as const,
        block_id: 'duration_block',
        label: {
          type: 'plain_text' as const,
          text: '⏱️ 사용 시간',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'duration_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '사용 시간을 선택하세요',
            emoji: false,
          },
          options: durationOptions,
        },
      },
      // 회의 이름 입력
      {
        type: 'input' as const,
        block_id: 'title_block',
        label: {
          type: 'plain_text' as const,
          text: '📝 회의 이름',
          emoji: true,
        },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'title_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '예: 주간 미팅',
            emoji: false,
          },
        },
      },
      // 참석자 선택 (선택 사항)
      {
        type: 'input' as const,
        block_id: 'attendees_block',
        label: {
          type: 'plain_text' as const,
          text: '👤 참석자',
          emoji: true,
        },
        optional: true,
        element: {
          type: 'multi_external_select' as const,
          action_id: 'attendees_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '이름으로 검색 (3글자 이상)',
            emoji: false,
          },
          min_query_length: 3,
        },
      },
    ],
  };
}

export function buildRoomSelectionForm(rooms: Room[], bookingId: string) {
  const roomOptions = rooms.slice(0, 10).map(room => ({
    text: { type: 'plain_text' as const, text: `${room.name} (최대 ${room.capacity}인)`, emoji: false },
    value: room.id,
  }));
  return {
    type: 'modal' as const,
    callback_id: 'book_room_select',
    private_metadata: JSON.stringify({ bookingId }),
    title: { type: 'plain_text' as const, text: '회의실 선택', emoji: true },
    submit: { type: 'plain_text' as const, text: '예약 확정', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      { type: 'section' as const, text: { type: 'mrkdwn' as const, text: '*회의실을 선택하세요:*' } },
      {
        type: 'input' as const,
        block_id: 'room_select_block',
        label: { type: 'plain_text' as const, text: '회의실', emoji: true },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'room_radio',
          initial_option: roomOptions[0],
          options: roomOptions,
        },
      },
    ],
  };
}
