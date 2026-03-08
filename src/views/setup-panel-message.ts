import type { KnownBlock } from '@slack/types';

export function buildSetupPanelMessage(): KnownBlock[] {
  return [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: '*🏢 미팅룸 예약 시스템*\n아래 버튼을 클릭하여 미팅룸을 예약하거나 기존 예약을 수정/취소할 수 있습니다.',
      },
    },
    { type: 'divider' as const },
    {
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: '📝 예약하기',
            emoji: true,
          },
          action_id: 'open_book_modal',
          style: 'primary' as const,
        },
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: '✏️ 수정/취소',
            emoji: true,
          },
          action_id: 'open_edit_modal',
        },
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: '📢 신고/건의',
            emoji: true,
          },
          action_id: 'open_report_modal',
        },
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: '🔁 정기회의',
            emoji: true,
          },
          action_id: 'open_recurring_modal',
        },
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: '📊 현황', emoji: true },
          action_id: 'open_status_modal',
        },
      ],
    },
  ];
}
