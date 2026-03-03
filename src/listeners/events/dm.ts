import type { App } from '@slack/bolt';
import { parseMessageIntent } from '../../services/message-parser.js';
import {
  getConversation,
  processConversationReply,
  startConversation,
  updateConversation,
  startFocusConversation,
  startEditConversation,
  buildInfoPrompt,
  buildTitlePrompt,
} from '../../services/conversation.js';

export function registerDmHandler(app: App): void {
  app.message(async ({ message, client, logger }) => {
    // message.subtype 체크: 봇 메시지, 편집, 삭제 등 무시 (무한루프 방지)
    if ('subtype' in message && message.subtype) return;
    // channel_type 체크: DM만 처리
    if (!('channel_type' in message) || message.channel_type !== 'im') return;
    // 텍스트 없으면 무시
    if (!('text' in message) || !message.text) return;
    // user 없으면 무시 (봇 메시지)
    if (!('user' in message) || !message.user) return;

    const userId = message.user;
    const channelId = message.channel;
    const text = message.text.trim();

    try {
      // 사용자 이메일 조회
      let userEmail = '';
      try {
        const userInfo = await client.users.info({ user: userId });
        userEmail = userInfo.user?.profile?.email ?? '';
      } catch { /* 무시 */ }

      // 진행 중인 대화 세션이 있으면 processConversationReply로 라우팅
      const existingConversation = getConversation(userId, channelId);
      if (existingConversation) {
        const reply = await processConversationReply({
          client,
          userId,
          channelId,
          text,
          userEmail,
        });
        await client.chat.postMessage({ channel: channelId, text: reply });
        return;
      }

      // 신고/건의 키워드 감지
      const REPORT_KEYWORDS = ['신고', '건의', '불편'];
      if (REPORT_KEYWORDS.some(kw => text.includes(kw))) {
        await client.chat.postMessage({
          channel: channelId,
          text: '신고/건의를 접수하려면 `/신고` 커맨드를 사용해주세요.',
        });
        return;
      }

      // 새 메시지: intent 파싱
      const intent = parseMessageIntent(text);
      if (!intent) {
        // 파싱 실패: 안내 메시지
        await client.chat.postMessage({
          channel: channelId,
          text: '안녕하세요! 미팅룸 예약을 도와드립니다.\n예: "내일 오후 2시에 4명 미팅룸 예약해줘"',
        });
        return;
      }

      // isEditIntent: 수정 의도 → /수정 안내
      if (intent.isEditIntent) {
        const reply = startEditConversation(userId, channelId);
        await client.chat.postMessage({ channel: channelId, text: reply });
        return;
      }

      // isBookingIntent: 예약 의도 → 대화형 예약 흐름
      if (intent.isBookingIntent) {
        // 포커스룸 요청
        if (intent.roomType === 'focus') {
          const reply = await startFocusConversation(
            userId,
            channelId,
            intent.parsedTime,
            intent.endTime,
          );
          await client.chat.postMessage({ channel: channelId, text: reply });
          return;
        }

        // 일반 미팅룸 예약
        if (intent.capacity !== null) {
          startConversation(userId, channelId, 'meeting', intent.parsedTime, intent.endTime, intent.capacity);
          updateConversation(userId, channelId, { stage: 'waiting_title' });
          await client.chat.postMessage({ channel: channelId, text: buildTitlePrompt() });
        } else {
          startConversation(userId, channelId, 'meeting', intent.parsedTime, intent.endTime);
          await client.chat.postMessage({ channel: channelId, text: buildInfoPrompt() });
        }
        return;
      }

      // 예약/수정 의도 없음: 안내 메시지
      await client.chat.postMessage({
        channel: channelId,
        text: '안녕하세요! 미팅룸 예약을 도와드립니다.\n예: "내일 오후 2시에 4명 미팅룸 예약해줘"',
      });
    } catch (error) {
      logger.error('DM 처리 오류:', error);
      try {
        await client.chat.postMessage({
          channel: channelId,
          text: '⚠️ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        });
      } catch { /* 무시 */ }
    }
  });
}
