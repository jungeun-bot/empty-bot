import type { App } from '@slack/bolt';
import { buildDateRoomSelectModal } from '../../views/edit-modal.js';

export function registerEditCommand(app: App): void {
  app.command('/수정', async ({ ack, body, client, logger }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildDateRoomSelectModal(body.channel_id),
      });
    } catch (error) {
      logger.error('/수정 커맨드 처리 오류:', error);
    }
  });
}
