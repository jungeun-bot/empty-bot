import { ROOMS } from '../config/rooms.js';
import { formatDateTime } from './common.js';
import type { BookingEvent } from '../types/index.js';

function formatDateYMD(date: Date): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractTimeStr(date: Date): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const m = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function generateEditTimeOptions() {
  const options: { text: { type: 'plain_text'; text: string; emoji: boolean }; value: string }[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 20 && minute === 30) continue;
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      const time = `${h}:${m}`;
      options.push({
        text: { type: 'plain_text' as const, text: time, emoji: false },
        value: time,
      });
    }
  }
  return options;
}

export function buildDateRoomSelectModal(channelId?: string) {
  return {
    type: 'modal' as const,
    callback_id: 'edit_date_room_select',
    title: {
      type: 'plain_text' as const,
      text: '예약 수정/취소',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '조회',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    private_metadata: JSON.stringify({ channelId: channelId ?? '' }),
    blocks: [
      {
        type: 'input' as const,
        block_id: 'date_block',
        label: {
          type: 'plain_text' as const,
          text: '날짜',
          emoji: true,
        },
        element: {
          type: 'datepicker' as const,
          action_id: 'date_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '날짜 선택',
            emoji: false,
          },
        },
      },
    ],
  };
}

export function buildBookingListModal(bookings: BookingEvent[], channelId?: string) {
  const date = formatDateYMD(bookings[0]!.startTime);

  const bookingOptions = bookings.slice(0, 10).map(b => {
    const optionText = `[${b.roomName}] ${formatDateTime(b.startTime)} ~ ${formatDateTime(b.endTime)} | ${b.summary}`;
    return {
      text: { type: 'plain_text' as const, text: optionText.length > 75 ? optionText.slice(0, 72) + '...' : optionText },
      value: `${b.roomId}::${b.eventId}`,
    };
  });

  const actionOptions = [
    { text: { type: 'plain_text' as const, text: '수정' }, value: 'edit' },
    { text: { type: 'plain_text' as const, text: '취소' }, value: 'cancel' },
  ];

  return {
    type: 'modal' as const,
    callback_id: 'edit_booking_select',
    title: {
      type: 'plain_text' as const,
      text: '예약 선택',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '다음',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    private_metadata: JSON.stringify({ date, channelId: channelId ?? '' }),
    blocks: [
      {
        type: 'input' as const,
        block_id: 'booking_select_block',
        label: {
          type: 'plain_text' as const,
          text: '예약 선택',
          emoji: true,
        },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'booking_radio',
          initial_option: bookingOptions[0],
          options: bookingOptions,
        },
      },
      {
        type: 'input' as const,
        block_id: 'action_select_block',
        label: {
          type: 'plain_text' as const,
          text: '작업 선택',
          emoji: true,
        },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'action_radio',
          initial_option: actionOptions[0],
          options: actionOptions,
        },
      },
    ],
  };
}

export function buildEditBookingModal(booking: BookingEvent, channelId?: string) {
  const timeOptions = generateEditTimeOptions();
  const currentStartTime = extractTimeStr(booking.startTime);
  const currentEndTime = extractTimeStr(booking.endTime);
  const currentDate = formatDateYMD(booking.startTime);

  const startInitial = timeOptions.find(o => o.value === currentStartTime) ?? timeOptions[0]!;
  const endInitial = timeOptions.find(o => o.value === currentEndTime) ?? timeOptions[0]!;

  return {
    type: 'modal' as const,
    callback_id: 'edit_booking_submit',
    title: {
      type: 'plain_text' as const,
      text: '예약 수정',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '수정',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    private_metadata: JSON.stringify({ eventId: booking.eventId, roomId: booking.roomId, date: currentDate, channelId: channelId ?? '' }),
    blocks: [
      {
        type: 'input' as const,
        block_id: 'title_block',
        label: {
          type: 'plain_text' as const,
          text: '회의 이름',
          emoji: true,
        },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'title_input',
          initial_value: booking.summary,
        },
      },
      {
        type: 'input' as const,
        block_id: 'date_block',
        label: {
          type: 'plain_text' as const,
          text: '날짜',
          emoji: true,
        },
        element: {
          type: 'datepicker' as const,
          action_id: 'date_input',
          initial_date: currentDate,
        },
      },
      {
        type: 'input' as const,
        block_id: 'start_time_block',
        label: {
          type: 'plain_text' as const,
          text: '시작 시간',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'start_time_input',
          options: timeOptions,
          initial_option: startInitial,
        },
      },
      {
        type: 'input' as const,
        block_id: 'end_time_block',
        label: {
          type: 'plain_text' as const,
          text: '종료 시간',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'end_time_input',
          options: timeOptions,
          initial_option: endInitial,
        },
      },
    ],
  };
}

export function buildCancelConfirmModal(booking: BookingEvent, channelId?: string) {
  const date = formatDateYMD(booking.startTime);

  return {
    type: 'modal' as const,
    callback_id: 'edit_cancel_confirm',
    title: {
      type: 'plain_text' as const,
      text: '예약 취소 확인',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '취소 확인',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '닫기',
      emoji: true,
    },
    private_metadata: JSON.stringify({ eventId: booking.eventId, roomId: booking.roomId, date, channelId: channelId ?? '' }),
    blocks: [
      {
        type: 'section' as const,
        block_id: 'confirm_block',
        text: {
          type: 'mrkdwn' as const,
          text: `*${booking.summary}* 예약을 취소하시겠습니까?\n\n*일시:* ${formatDateTime(booking.startTime)} ~ ${formatDateTime(booking.endTime)}`,
        },
      },
    ],
  };
}
