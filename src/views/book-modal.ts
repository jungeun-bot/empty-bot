/** 모달 재구성 시 기존 입력값 보존을 위한 옵션 */
export interface BookModalOptions {
  /** 게스트 이메일 입력 필드 표시 여부 */
  showGuestEmails?: boolean;
  /** 모달 업데이트 시 기존 입력값 보존 */
  initialValues?: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    attendees?: Array<{ text: { type: 'plain_text'; text: string }; value: string }>;
    guestEmails?: string;
  };
}

export function buildBookModal(channelId: string, options: BookModalOptions = {}) {
  const iv = options.initialValues;

  return {
    type: 'modal' as const,
    callback_id: 'book_modal',
    private_metadata: JSON.stringify({ channelId }),
    title: { type: 'plain_text' as const, text: '미팅룸 예약', emoji: true },
    submit: { type: 'plain_text' as const, text: '미팅룸 검색', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      {
        type: 'section' as const,
        block_id: 'room_type_block',
        text: { type: 'mrkdwn' as const, text: '*예약 유형을 선택하세요:*' },
        accessory: {
          type: 'radio_buttons' as const,
          action_id: 'book_type_select',
          initial_option: { text: { type: 'plain_text' as const, text: '🏢 미팅룸', emoji: true }, value: 'meeting' },
          options: [
            { text: { type: 'plain_text' as const, text: '🏢 미팅룸', emoji: true }, value: 'meeting' },
            { text: { type: 'plain_text' as const, text: '🎯 포커스룸 (1인용)', emoji: true }, value: 'focus' },
          ],
        },
      },
      {
        type: 'input' as const,
        block_id: 'title_block',
        label: { type: 'plain_text' as const, text: '📝 회의 이름', emoji: true },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'title_input',
          placeholder: { type: 'plain_text' as const, text: '예: 주간 미팅, 프로젝트 킥오프', emoji: false },
          ...(iv?.title ? { initial_value: iv.title } : {}),
        },
      },
      {
        type: 'input' as const,
        block_id: 'date_block',
        label: { type: 'plain_text' as const, text: '📅 날짜', emoji: true },
        element: {
          type: 'datepicker' as const,
          action_id: 'date_input',
          placeholder: { type: 'plain_text' as const, text: '날짜를 선택하세요', emoji: false },
          ...(iv?.date ? { initial_date: iv.date } : {}),
        },
      },
      {
        type: 'input' as const,
        block_id: 'start_time_block',
        label: { type: 'plain_text' as const, text: '🕐 시작 시간', emoji: true },
        element: {
          type: 'timepicker' as const,
          action_id: 'start_time_input',
          placeholder: { type: 'plain_text' as const, text: '시작 시간 선택', emoji: false },
          ...(iv?.startTime ? { initial_time: iv.startTime } : {}),
        },
      },
      {
        type: 'input' as const,
        block_id: 'end_time_block',
        label: { type: 'plain_text' as const, text: '🕐 종료 시간', emoji: true },
        element: {
          type: 'timepicker' as const,
          action_id: 'end_time_input',
          placeholder: { type: 'plain_text' as const, text: '종료 시간 선택', emoji: false },
          ...(iv?.endTime ? { initial_time: iv.endTime } : {}),
        },
      },
      {
        type: 'input' as const,
        block_id: 'attendees_block',
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
