import { generateTimeOptions } from './common.js';

export function buildBookModal(channelId: string) {
  const timeOptions = generateTimeOptions();

  return {
    type: 'modal' as const,
    callback_id: 'book_modal',
    private_metadata: JSON.stringify({ channelId }),
    title: {
      type: 'plain_text' as const,
      text: '회의실 예약',
      emoji: true,
    },
    submit: {
      type: 'plain_text' as const,
      text: '회의실 검색',
      emoji: true,
    },
    close: {
      type: 'plain_text' as const,
      text: '취소',
      emoji: true,
    },
    blocks: [
      {
        type: 'section' as const,
        block_id: 'room_type_block',
        text: { type: 'mrkdwn' as const, text: '*예약 유형을 선택하세요:*' },
        accessory: {
          type: 'radio_buttons' as const,
          action_id: 'book_type_select',
          initial_option: { text: { type: 'plain_text' as const, text: '🏢 회의실', emoji: true }, value: 'meeting' },
          options: [
            { text: { type: 'plain_text' as const, text: '🏢 회의실', emoji: true }, value: 'meeting' },
            { text: { type: 'plain_text' as const, text: '🎯 포커싱룸 (1인용)', emoji: true }, value: 'focusing' },
          ],
        },
      },
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
            text: '예: 주간 미팅, 프로젝트 킥오프',
            emoji: false,
          },
        },
      },
      {
        type: 'input' as const,
        block_id: 'date_block',
        label: {
          type: 'plain_text' as const,
          text: '📅 날짜',
          emoji: true,
        },
        element: {
          type: 'datepicker' as const,
          action_id: 'date_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '날짜를 선택하세요',
            emoji: false,
          },
        },
      },
      {
        type: 'input' as const,
        block_id: 'start_time_block',
        label: {
          type: 'plain_text' as const,
          text: '🕐 시작 시간',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'start_time_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '시작 시간 선택',
            emoji: false,
          },
          options: timeOptions,
        },
      },
      {
        type: 'input' as const,
        block_id: 'end_time_block',
        label: {
          type: 'plain_text' as const,
          text: '🕐 종료 시간',
          emoji: true,
        },
        element: {
          type: 'static_select' as const,
          action_id: 'end_time_input',
          placeholder: {
            type: 'plain_text' as const,
            text: '종료 시간 선택',
            emoji: false,
          },
          options: timeOptions,
        },
      },
      {
        type: 'input' as const,
        block_id: 'capacity_block',
        label: {
          type: 'plain_text' as const,
          text: '👥 참석 인원수',
          emoji: true,
        },
        element: {
          type: 'number_input' as const,
          action_id: 'capacity_input',
          is_decimal_allowed: false,
          min_value: '1',
          max_value: '50',
          placeholder: {
            type: 'plain_text' as const,
            text: '인원수 입력 (1~50)',
            emoji: false,
          },
        },
      },
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
