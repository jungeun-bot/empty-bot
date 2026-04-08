import { formatDateTime } from './common.js';
import type { BookingEvent } from '../types/index.js';
import { ROOMS } from '../config/rooms.js';

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
  const currentStartTime = extractTimeStr(booking.startTime);
  const currentEndTime = extractTimeStr(booking.endTime);
  const currentDate = formatDateYMD(booking.startTime);

  // 회의실 옵션
  const roomOptions = ROOMS.map(r => ({
    text: { type: 'plain_text' as const, text: `${r.name} (${r.capacity}인)`, emoji: false },
    value: r.id,
  }));
  const currentRoomOption = roomOptions.find(o => o.value === booking.roomId) ?? roomOptions[0]!;

  // 참석자 초기값 (리소스 캘린더 + 주최자 제외)
  const attendeeInitialOptions = booking.attendees
    .filter(email => !email.includes('@resource.calendar.google.com') && email !== booking.organizer)
    .map(email => ({
      text: { type: 'plain_text' as const, text: email, emoji: false },
      value: email,
    }));

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
        block_id: 'room_block',
        label: {
          type: 'plain_text' as const,
          text: '회의실',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'room_input',
          options: roomOptions,
          initial_option: currentRoomOption,
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
          type: 'plain_text_input' as const,
          action_id: 'start_time_input',
          initial_value: currentStartTime,
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
          type: 'plain_text_input' as const,
          action_id: 'end_time_input',
          initial_value: currentEndTime,
        },
      },
      {
        type: 'input' as const,
        block_id: 'attendees_block',
        optional: true,
        label: {
          type: 'plain_text' as const,
          text: '참석자',
          emoji: true,
        },
        element: {
          type: 'multi_external_select' as const,
          action_id: 'attendees_input',
          placeholder: { type: 'plain_text' as const, text: '이름 또는 그룹명으로 검색', emoji: false },
          min_query_length: 0,
          ...(attendeeInitialOptions.length > 0 ? { initial_options: attendeeInitialOptions } : {}),
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

/**
 * 정기회의 수정 방식 선택 모달
 * '이 일정만 수정' vs '전체 정기일정 시간 변경'
 */
export function buildRecurringEditChoiceModal(booking: BookingEvent, channelId: string) {
  return {
    type: 'modal' as const,
    callback_id: 'recurring_edit_choice',
    private_metadata: JSON.stringify({
      eventId: booking.eventId,
      roomId: booking.roomId,
      recurringEventId: booking.recurringEventId,
      channelId,
    }),
    title: { type: 'plain_text' as const, text: '정기회의 수정', emoji: true },
    submit: { type: 'plain_text' as const, text: '다음', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `🔁 *${booking.summary}*\n이 일정은 정기회의입니다. 수정 방식을 선택해주세요.`,
        },
      },
      {
        type: 'input' as const,
        block_id: 'recurring_choice_block',
        label: { type: 'plain_text' as const, text: '수정 범위', emoji: true },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'recurring_choice',
          initial_option: {
            text: { type: 'plain_text' as const, text: '📅 이 일정만 수정', emoji: true },
            value: 'single',
          },
          options: [
            {
              text: { type: 'plain_text' as const, text: '📅 이 일정만 수정', emoji: true },
              value: 'single',
            },
            {
              text: { type: 'plain_text' as const, text: '🔁 전체 정기일정 수정', emoji: true },
              value: 'all',
            },
          ],
        },
      },
    ],
  };
}

/**
 * 정기회의 전체 수정 모달 (이름, 회의실, 참석자, 시간 수정)
 */
export function buildRecurringTimeEditModal(booking: BookingEvent, channelId: string) {
  const kstOffset = 9 * 60 * 60 * 1000;
  const startKst = new Date(booking.startTime.getTime() + kstOffset);
  const endKst = new Date(booking.endTime.getTime() + kstOffset);
  const currentStartTime = `${String(startKst.getUTCHours()).padStart(2, '0')}:${String(startKst.getUTCMinutes()).padStart(2, '0')}`;
  const currentEndTime = `${String(endKst.getUTCHours()).padStart(2, '0')}:${String(endKst.getUTCMinutes()).padStart(2, '0')}`;

  // 회의실 옵션
  const roomOptions = ROOMS.map(r => ({
    text: { type: 'plain_text' as const, text: `${r.name} (${r.capacity}인)`, emoji: false },
    value: r.id,
  }));
  const currentRoomOption = roomOptions.find(o => o.value === booking.roomId) ?? roomOptions[0]!;

  // 참석자 초기값 (리소스 캘린더 + 주최자 제외)
  const attendeeInitialOptions = booking.attendees
    .filter(email => !email.includes('@resource.calendar.google.com') && email !== booking.organizer)
    .map(email => ({
      text: { type: 'plain_text' as const, text: email, emoji: false },
      value: email,
    }));

  return {
    type: 'modal' as const,
    callback_id: 'recurring_time_edit_submit',
    private_metadata: JSON.stringify({
      recurringEventId: booking.recurringEventId,
      roomId: booking.roomId,
      channelId,
    }),
    title: { type: 'plain_text' as const, text: '정기회의 전체 수정', emoji: true },
    submit: { type: 'plain_text' as const, text: '전체 수정', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `🔁 *${booking.summary}*\n모든 정기일정이 수정됩니다.`,
        },
      },
      {
        type: 'input' as const,
        block_id: 'title_block',
        label: { type: 'plain_text' as const, text: '📝 회의 이름', emoji: true },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'title_input',
          initial_value: booking.summary.replace(/^\[.*?\]\s*/, ''),
        },
      },
      {
        type: 'input' as const,
        block_id: 'room_block',
        label: { type: 'plain_text' as const, text: '🏢 회의실', emoji: true },
        element: {
          type: 'static_select' as const,
          action_id: 'room_input',
          options: roomOptions,
          initial_option: currentRoomOption,
        },
      },
      {
        type: 'input' as const,
        block_id: 'start_time_block',
        label: { type: 'plain_text' as const, text: '🕐 시작 시간', emoji: true },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'start_time_input',
          placeholder: { type: 'plain_text' as const, text: 'HH:MM (예: 09:15, 14:45)', emoji: false },
          initial_value: currentStartTime,
        },
      },
      {
        type: 'input' as const,
        block_id: 'end_time_block',
        label: { type: 'plain_text' as const, text: '🕐 종료 시간', emoji: true },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'end_time_input',
          placeholder: { type: 'plain_text' as const, text: 'HH:MM (예: 17:00, 18:30)', emoji: false },
          initial_value: currentEndTime,
        },
      },
      {
        type: 'input' as const,
        block_id: 'attendees_block',
        optional: true,
        label: { type: 'plain_text' as const, text: '👥 참석자 / 그룹', emoji: true },
        element: {
          type: 'multi_external_select' as const,
          action_id: 'attendees_input',
          placeholder: { type: 'plain_text' as const, text: '이름 또는 그룹명으로 검색', emoji: false },
          min_query_length: 0,
          ...(attendeeInitialOptions.length > 0 ? { initial_options: attendeeInitialOptions } : {}),
        },
      },
    ],
  };
}
