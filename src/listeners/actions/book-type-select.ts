import type { App } from '@slack/bolt';
import { buildBookModal } from '../../views/book-modal.js';

export function registerBookTypeSelectAction(app: App): void {
  app.action('book_type_select', async ({ ack, action, body, client, logger }) => {
    await ack();

    try {
      const selectedType = (action as { selected_option?: { value?: string } }).selected_option?.value ?? 'meeting';
      let channelId = '';
      try {
        const meta = JSON.parse(
          (body as { view?: { private_metadata?: string } }).view?.private_metadata ?? '{}'
        ) as { channelId?: string };
        channelId = meta.channelId ?? '';
      } catch {
        // 파싱 실패 시 빈 문자열
      }

      const viewId = (body as { view?: { id?: string } }).view?.id ?? '';
      if (!viewId) return;

      if (selectedType === 'focus') {
        // 포커스룸 모달: 인원/참석자 없음
        const focusModal = {
          type: 'modal' as const,
          callback_id: 'book_modal',
          private_metadata: JSON.stringify({ channelId, roomType: 'focus' }),
          title: { type: 'plain_text' as const, text: '포커스룸 예약', emoji: true },
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
                initial_option: { text: { type: 'plain_text' as const, text: '🎯 포커스룸 (1인용)', emoji: true }, value: 'focus' },
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
                placeholder: { type: 'plain_text' as const, text: '예: 집중 작업, 개인 미팅', emoji: false },
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
              },
            },
            {
              type: 'input' as const,
              block_id: 'start_time_block',
              label: { type: 'plain_text' as const, text: '🕐 시작 시간', emoji: true },
              hint: { type: 'plain_text' as const, text: '드롭다운 외에 원하는 시간을 직접 입력할 수 있습니다 (예: 09:15, 14:45)', emoji: false },
              element: {
                type: 'timepicker' as const,
                action_id: 'start_time_input',
                placeholder: { type: 'plain_text' as const, text: '시작 시간 선택', emoji: false },
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
              },
            },
          ],
        };
        await client.views.update({ view_id: viewId, view: focusModal });
      } else {
        // 미팅룸 모달: 기존 전체 필드
        const meetingModal = {
          ...buildBookModal(channelId),
          private_metadata: JSON.stringify({ channelId, roomType: 'meeting' }),
        };
        await client.views.update({ view_id: viewId, view: meetingModal });
      }
    } catch (error) {
      logger.error('book_type_select 처리 오류:', error);
    }
  });
}

