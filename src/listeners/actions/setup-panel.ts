import type { App } from '@slack/bolt';
import { buildBookModal } from '../../views/book-modal.js';
import { buildDateRoomSelectModal } from '../../views/edit-modal.js';
import { buildReportModal } from '../../views/report-modal.js';

export function registerSetupPanelActions(app: App): void {
  // 예약 버튼 → 예약 모달 열기
  app.action('open_book_modal', async ({ ack, body, client, logger }) => {
    await ack();

    try {
      const channelId = (body as { channel?: { id?: string } }).channel?.id ?? '';
      const triggerId = (body as { trigger_id?: string }).trigger_id;
      if (!triggerId) return;

      await client.views.open({
        trigger_id: triggerId,
        view: buildBookModal(channelId),
      });
    } catch (error) {
      logger.error('open_book_modal 액션 처리 오류:', error);
    }
  });

  // 수정/취소 버튼 → 수정 모달 열기
  app.action('open_edit_modal', async ({ ack, body, client, logger }) => {
    await ack();

    try {
      const triggerId = (body as { trigger_id?: string }).trigger_id;
      if (!triggerId) return;

      await client.views.open({
        trigger_id: triggerId,
        view: buildDateRoomSelectModal(),
      });
    } catch (error) {
      logger.error('open_edit_modal 액션 처리 오류:', error);
    }
  });

  // 신고/건의 버튼 → 신고 모달 열기
  app.action('open_report_modal', async ({ ack, body, client, logger }) => {
    await ack();

    try {
      const triggerId = (body as { trigger_id?: string }).trigger_id;
      if (!triggerId) return;

      await client.views.open({
        trigger_id: triggerId,
        view: buildReportModal(),
      });
    } catch (error) {
      logger.error('open_report_modal 액션 처리 오류:', error);
    }
  });
}
