import type { App } from '@slack/bolt';
import { buildReportModal } from '../../views/report-modal.js';

export function registerReportCommand(app: App): void {
  app.command('/신고', async ({ command, ack, client, logger }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildReportModal(),
      });
    } catch (error) {
      logger.error('/신고 모달 오픈 실패:', error);
    }
  });
}
