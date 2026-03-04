import type { App } from '@slack/bolt';
import { buildRecurringModal } from '../../views/recurring-modal.js';

export function registerRecurringCommand(app: App): void {
  app.command('/정기회의', async ({ command, ack, client, logger }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildRecurringModal(command.channel_id),
      });
    } catch (error) {
      logger.error('/정기회의 모달 오픈 실패:', error);
    }
  });

  // 외부 게스트 토글 (dispatch_action)
  app.action('recurring_guest_select', async ({ ack, body, client, logger }) => {
    await ack();

    try {
      if (body.type !== 'block_actions' || !body.view) return;
      const view = body.view;
      const values = view.state.values;

      const showGuest = values['guest_radio_block']?.['recurring_guest_select']?.selected_option?.value === 'yes';

      // 기존 입력값 보존
      let channelId = '';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as { channelId?: string };
        channelId = meta.channelId ?? '';
      } catch { /* 무시 */ }

      const startOpt = values['start_time_block']?.['start_time_input']?.selected_option;
      const endOpt = values['end_time_block']?.['end_time_input']?.selected_option;
      const freqOpt = values['frequency_block']?.['frequency_input']?.selected_option;

      await client.views.update({
        view_id: view.id,
        view: buildRecurringModal(channelId, {
          showGuestEmails: showGuest,
          initialValues: {
            title: values['title_block']?.['title_input']?.value ?? undefined,
            date: values['date_block']?.['date_input']?.selected_date ?? undefined,
            startTime: startOpt ? { text: startOpt.text as { type: 'plain_text'; text: string }, value: startOpt.value } : undefined,
            endTime: endOpt ? { text: endOpt.text as { type: 'plain_text'; text: string }, value: endOpt.value } : undefined,
            frequency: freqOpt ? { text: freqOpt.text as { type: 'plain_text'; text: string }, value: freqOpt.value } : undefined,
            until: values['until_block']?.['until_input']?.selected_date ?? undefined,
            guestEmails: values['guest_emails_block']?.['guest_emails_input']?.value ?? undefined,
          },
        }),
      });
    } catch (error) {
      logger.error('recurring_guest_select 액션 처리 오류:', error);
    }
  });
}
