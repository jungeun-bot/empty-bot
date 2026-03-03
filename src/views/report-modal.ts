export function buildReportModal() {
  return {
    type: 'modal' as const,
    callback_id: 'report_modal',
    title: { type: 'plain_text' as const, text: '신고/건의', emoji: true },
    submit: { type: 'plain_text' as const, text: '제출', emoji: true },
    close: { type: 'plain_text' as const, text: '취소', emoji: true },
    blocks: [
      {
        type: 'input' as const,
        block_id: 'report_type_block',
        label: { type: 'plain_text' as const, text: '신고 유형', emoji: true },
        element: {
          type: 'radio_buttons' as const,
          action_id: 'report_type_input',
          options: [
            { text: { type: 'plain_text' as const, text: '건의사항', emoji: false }, value: 'suggestion' },
            { text: { type: 'plain_text' as const, text: '불편사항', emoji: false }, value: 'complaint' },
            { text: { type: 'plain_text' as const, text: '기타', emoji: false }, value: 'other' },
          ],
        },
      },
      {
        type: 'input' as const,
        block_id: 'report_content_block',
        label: { type: 'plain_text' as const, text: '상세 내용', emoji: true },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'report_content_input',
          multiline: true,
          min_length: 1,
          max_length: 2000,
          placeholder: { type: 'plain_text' as const, text: '상세한 내용을 입력해주세요', emoji: false },
        },
      },
    ],
  };
}
