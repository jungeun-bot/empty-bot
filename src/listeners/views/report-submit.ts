import type { App } from '@slack/bolt';
import { env, BOT_DISPLAY_NAME } from '../../config/env.js';

export function registerReportSubmit(app: App): void {
  app.view('report_modal', async ({ ack, view, body, client, logger }) => {
    await ack({
      response_action: 'update',
      view: {
        type: 'modal' as const,
        callback_id: 'report_done',
        title: { type: 'plain_text' as const, text: '접수 완료', emoji: true },
        close: { type: 'plain_text' as const, text: '닫기', emoji: true },
        blocks: [
          {
            type: 'section' as const,
            text: { type: 'mrkdwn' as const, text: '✅ *신고/건의가 접수되었습니다.*\n\n감사합니다. 불편사항은 빠르게 개선하겠습니다.' },
          },
        ],
      },
    });

    try {
      const userId = body.user.id;
      const userName = body.user.name;

      // 신고 유형 파싱
      const typeValue = view.state.values['report_type_block']?.['report_type_input']?.selected_option?.value ?? '';
      const typeLabel = typeValue === 'suggestion' ? '건의사항'
        : typeValue === 'complaint' ? '불편사항'
        : '기타';

      // 상세내용 파싱
      const content = view.state.values['report_content_block']?.['report_content_input']?.value ?? '';

      const adminUserId = env.admin.slackUserId;

      // 관리자 DM (ADMIN 설정 시)
      if (adminUserId) {
        try {
          await client.chat.postMessage({
            channel: adminUserId,
            text: `📢 *새 신고/건의가 접수되었습니다*\n*신고자:* <@${userId}> (${userName})\n*유형:* ${typeLabel}\n*내용:*\n${content}\n*시간:* ${new Date().toLocaleString('ko-KR')}`,
            username: BOT_DISPLAY_NAME,
          });
        } catch (adminError) {
          logger.warn('관리자 DM 전송 실패:', adminError);
        }
      } else {
        logger.warn('ADMIN_SLACK_USER_ID가 설정되지 않아 관리자 DM을 전송하지 않습니다.');
      }

    } catch (error) {
      logger.error('report_modal 제출 처리 오류:', error);
    }
  });
}
