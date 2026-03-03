import type { Room, Attendee } from '../types/index.js';
import { formatDateTime, formatTimeRange } from './common.js';

/** 모달 재구성 시 기존 입력값 보존을 위한 옵션 */
export interface EndTimeModalOptions {
  /** 게스트 이메일 입력 필드 표시 여부 */
  showGuestEmails?: boolean;
  /** 모달 업데이트 시 기존 입력값 보존 */
  initialValues?: {
    duration?: string;
    title?: string;
    attendees?: Array<{ text: { type: 'plain_text'; text: string }; value: string }>;
    guestEmails?: string;
  };
}


export function buildRoomSelectMessage(
  rooms: Room[],
  bookingId: string,
): object[] {
  const blocks: object[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🏢 예약 가능한 미팅룸*\n아래 목록에서 미팅룸을 선택하세요:',
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
          text: `✅ *예약이 완료되었습니다!*\n\n*미팅룸:* ${room.name}\n*일시:* ${formatDateTime(startTime)}\n*시간:* ${formatTimeRange(startTime, endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 참석자에게 발송되었습니다.`,
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
  options: EndTimeModalOptions = {},
) {
  const iv = options.initialValues;
  const availabilityNote = availableUntil
    ? `이 미팅룸은 ${String(availableUntil.getHours()).padStart(2, '0')}:${String(availableUntil.getMinutes()).padStart(2, '0')}까지 사용 가능합니다.`
    : '이 미팅룸은 오늘 종일 사용 가능합니다.';

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
          ...(iv?.title ? { initial_value: iv.title } : {}),
        },
      },
      // 참석자 / 그룹 선택 (선택 사항)
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
          ...(iv?.attendees && iv.attendees.length > 0 ? { initial_options: iv.attendees } : {}),
        },
      },
      // 외부 게스트 유무 라디오 (dispatch_action으로 동적 필드 토글)
      {
        type: 'input' as const,
        block_id: 'guest_radio_block',
        dispatch_action: true,
        optional: true,
        label: { type: 'plain_text' as const, text: '🧑‍💼 외부 게스트', emoji: true },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'guest_select',
          initial_option: options.showGuestEmails
            ? { text: { type: 'plain_text' as const, text: '있음', emoji: false }, value: 'yes' }
            : { text: { type: 'plain_text' as const, text: '없음', emoji: false }, value: 'no' },
          options: [
            { text: { type: 'plain_text' as const, text: '없음', emoji: false }, value: 'no' },
            { text: { type: 'plain_text' as const, text: '있음', emoji: false }, value: 'yes' },
          ],
        },
      },
      // "있음" 선택 시 게스트 이메일 입력 필드 추가
      ...(options.showGuestEmails ? [
        {
          type: 'input' as const,
          block_id: 'guest_emails_block',
          optional: true,
          label: { type: 'plain_text' as const, text: '📧 게스트 이메일', emoji: true },
          hint: { type: 'plain_text' as const, text: '쉼표(,) 또는 줄바꿈으로 구분하여 입력하세요. 입력된 이메일로 캘린더 초대장이 발송됩니다.', emoji: false },
          element: {
            type: 'plain_text_input' as const,
            action_id: 'guest_emails_input',
            multiline: true,
            placeholder: { type: 'plain_text' as const, text: 'guest1@example.com, guest2@example.com', emoji: false },
            ...(iv?.guestEmails ? { initial_value: iv.guestEmails } : {}),
          },
        },
      ] : []),
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
    title: { type: 'plain_text' as const, text: '미팅룸 선택', emoji: true },
    submit: { type: 'plain_text' as const, text: '예약 확정', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      { type: 'section' as const, text: { type: 'mrkdwn' as const, text: '*미팅룸을 선택하세요:*' } },
      {
        type: 'input' as const,
        block_id: 'room_select_block',
        label: { type: 'plain_text' as const, text: '미팅룸', emoji: true },
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
