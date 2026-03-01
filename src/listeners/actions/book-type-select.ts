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

      if (selectedType === 'focusing') {
        // 포커싱룸 모달: 인원/참석자 없음
        const focusingModal = {
          type: 'modal' as const,
          callback_id: 'book_modal',
          private_metadata: JSON.stringify({ channelId, roomType: 'focusing' }),
          title: { type: 'plain_text' as const, text: '포커싱룸 예약', emoji: true },
          submit: { type: 'plain_text' as const, text: '회의실 검색', emoji: true },
          close: { type: 'plain_text' as const, text: '취소', emoji: true },
          blocks: [
            {
              type: 'section' as const,
              block_id: 'room_type_block',
              text: { type: 'mrkdwn' as const, text: '*예약 유형을 선택하세요:*' },
              accessory: {
                type: 'radio_buttons' as const,
                action_id: 'book_type_select',
                initial_option: { text: { type: 'plain_text' as const, text: '🎯 포커싱룸 (1인용)', emoji: true }, value: 'focusing' },
                options: [
                  { text: { type: 'plain_text' as const, text: '🏢 회의실', emoji: true }, value: 'meeting' },
                  { text: { type: 'plain_text' as const, text: '🎯 포커싱룸 (1인용)', emoji: true }, value: 'focusing' },
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
              element: {
                type: 'static_select' as const,
                action_id: 'start_time_input',
                placeholder: { type: 'plain_text' as const, text: '시작 시간 선택', emoji: false },
                options: generateTimeOptionsInline(),
              },
            },
            {
              type: 'input' as const,
              block_id: 'end_time_block',
              label: { type: 'plain_text' as const, text: '🕐 종료 시간', emoji: true },
              element: {
                type: 'static_select' as const,
                action_id: 'end_time_input',
                placeholder: { type: 'plain_text' as const, text: '종료 시간 선택', emoji: false },
                options: generateTimeOptionsInline(),
              },
            },
          ],
        };
        await client.views.update({ view_id: viewId, view: focusingModal });
      } else {
        // 회의실 모달: 기존 전체 필드
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

function generateTimeOptionsInline() {
  const options = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      options.push({
        text: { type: 'plain_text' as const, text: `${hh}:${mm}`, emoji: false },
        value: `${hh}:${mm}`,
      });
    }
  }
  return options;
}
