import type { App } from '@slack/bolt';
import { buildBookModal } from '../../views/book-modal.js';
import { buildDateRoomSelectModal } from '../../views/edit-modal.js';
import { buildReportModal } from '../../views/report-modal.js';
import { buildRecurringModal } from '../../views/recurring-modal.js';
import { buildStatusModal } from '../../views/status-modal.js';

/**
 * 워크플로 빌더 연동용 폼 열기 함수 등록
 * - 각 함수는 interactivity_pointer를 받아 모달을 열고 즉시 complete
 * - Workflow Builder에서 "링크" 트리거로 호출됨
 */
export function registerOpenFormFunctions(app: App): void {
  // 예약하기 폼
  app.function('open_book_form', async ({ inputs, client, complete, fail, logger }) => {
    try {
      const pointer = (inputs as Record<string, unknown>).interactivity as
        | { interactivity_pointer: string }
        | undefined;

      if (!pointer?.interactivity_pointer) {
        await fail({ error: 'interactivity 정보가 없습니다.' });
        return;
      }

      await client.views.open({
        interactivity_pointer: pointer.interactivity_pointer,
        view: buildBookModal(''),
      });

      await complete({ outputs: { opened: true } });
    } catch (error) {
      logger.error('open_book_form 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '예약 폼 열기 실패' });
    }
  });

  // 수정/취소 폼
  app.function('open_edit_form', async ({ inputs, client, complete, fail, logger }) => {
    try {
      const pointer = (inputs as Record<string, unknown>).interactivity as
        | { interactivity_pointer: string }
        | undefined;

      if (!pointer?.interactivity_pointer) {
        await fail({ error: 'interactivity 정보가 없습니다.' });
        return;
      }

      await client.views.open({
        interactivity_pointer: pointer.interactivity_pointer,
        view: buildDateRoomSelectModal(''),
      });

      await complete({ outputs: { opened: true } });
    } catch (error) {
      logger.error('open_edit_form 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '수정/취소 폼 열기 실패' });
    }
  });

  // 신고/건의 폼
  app.function('open_report_form', async ({ inputs, client, complete, fail, logger }) => {
    try {
      const pointer = (inputs as Record<string, unknown>).interactivity as
        | { interactivity_pointer: string }
        | undefined;

      if (!pointer?.interactivity_pointer) {
        await fail({ error: 'interactivity 정보가 없습니다.' });
        return;
      }

      await client.views.open({
        interactivity_pointer: pointer.interactivity_pointer,
        view: buildReportModal(),
      });

      await complete({ outputs: { opened: true } });
    } catch (error) {
      logger.error('open_report_form 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '신고/건의 폼 열기 실패' });
    }
  });

  // 정기회의 폼
  app.function('open_recurring_form', async ({ inputs, client, complete, fail, logger }) => {
    try {
      const pointer = (inputs as Record<string, unknown>).interactivity as
        | { interactivity_pointer: string }
        | undefined;

      if (!pointer?.interactivity_pointer) {
        await fail({ error: 'interactivity 정보가 없습니다.' });
        return;
      }

      await client.views.open({
        interactivity_pointer: pointer.interactivity_pointer,
        view: buildRecurringModal(''),
      });

      await complete({ outputs: { opened: true } });
    } catch (error) {
      logger.error('open_recurring_form 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '정기회의 폼 열기 실패' });
    }
  });

  // 현황 폼
  app.function('open_status_form', async ({ inputs, client, complete, fail, logger }) => {
    try {
      const pointer = (inputs as Record<string, unknown>).interactivity as
        | { interactivity_pointer: string }
        | undefined;

      if (!pointer?.interactivity_pointer) {
        await fail({ error: 'interactivity 정보가 없습니다.' });
        return;
      }

      await client.views.open({
        interactivity_pointer: pointer.interactivity_pointer,
        view: buildStatusModal(''),
      });

      await complete({ outputs: { opened: true } });
    } catch (error) {
      logger.error('open_status_form 오류:', error);
      await fail({ error: error instanceof Error ? error.message : '현황 폼 열기 실패' });
    }
  });
}
