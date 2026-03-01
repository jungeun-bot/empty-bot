import type { App } from '@slack/bolt';
import { buildBookModal } from '../../views/book-modal.js';

export function registerBookCommand(app: App): void {
  app.command('/book', async ({ command, ack, client, logger }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildBookModal(command.channel_id),
      });
    } catch (error) {
      logger.error('/book 모달 오픈 실패:', error);
    }
  });
}
