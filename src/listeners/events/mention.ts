import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { PendingBooking } from '../../types/index.js';
import { parseMessageIntent } from '../../services/message-parser.js';
import { BOT_DISPLAY_NAME } from '../../config/env.js';
import { getAvailableRooms, getRoomAvailableUntil } from '../../services/calendar.js';
import {
  buildMentionResponse,
  buildNoRoomResponse,
  buildTimeErrorResponse,
} from '../../views/mention-response.js';
import { pendingBookings } from '../views/book-submit.js';
import {
  getConversation,
  processConversationReply,
  startConversation,
  startFocusConversation,
  startEditConversation,
  buildInfoPrompt,
} from '../../services/conversation.js';

function generateBookingId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function registerMentionHandler(app: App): void {
  app.event('app_mention', async ({ event, client, logger }) => {
    if (!event.user || !event.channel) return;
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

    try {
      // 사용자 이메일 조회 (대화 흐름에서 필요)
      let userEmail = '';
      try {
        const userInfo = await client.users.info({ user: event.user });
        userEmail = userInfo.user?.profile?.email ?? '';
      } catch { /* 무시 */ }

      // 진행 중인 대화 세션이 있으면 processConversationReply로 라우팅
      const existingConversation = getConversation(event.user, event.channel);
      if (existingConversation) {
        const reply = await processConversationReply({
          client,
          userId: event.user,
          channelId: event.channel,
          text: cleanText,
          userEmail,
        });
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          text: reply,
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      // 신고/건의 키워드 감지
      const REPORT_KEYWORDS = ['신고', '건의', '불편'];
      if (REPORT_KEYWORDS.some(kw => cleanText.includes(kw))) {
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          text: '신고/건의를 접수하려면 `/신고` 커맨드를 사용해주세요.',
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      const intent = parseMessageIntent(cleanText);

      if (!intent) {
        return;
      }

      // isEditIntent: 수정 의도 → 안내 메시지
      if (intent.isEditIntent) {
        const reply = startEditConversation(event.user, event.channel);
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          text: reply,
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      // isBookingIntent: 예약 의도 → 대화형 예약 흐름
      if (intent.isBookingIntent) {
        // 포커스룸 요청
        if (intent.roomType === 'focus') {
          const reply = await startFocusConversation(
            event.user,
            event.channel,
            intent.parsedTime,
            intent.endTime,
          );
          await client.chat.postEphemeral({
            channel: event.channel,
            user: event.user,
            text: reply,
            username: BOT_DISPLAY_NAME,
          });
          return;
        }

        // 일반 미팅룸 예약 — 항상 참석자 입력 단계부터 시작
        startConversation(event.user, event.channel, 'meeting', intent.parsedTime, intent.endTime, intent.capacity ?? undefined);
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          text: buildInfoPrompt(),
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      // isBookingIntent=false, isEditIntent=false → 기존 조회 흐름
      const minCapacity = intent.capacity ?? 1;
      const availableRooms = await getAvailableRooms(
        intent.parsedTime,
        intent.endTime,
        minCapacity,
      );

      if (availableRooms.length === 0) {
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          blocks: buildNoRoomResponse(intent.parsedTime, intent.capacity) as KnownBlock[],
          text: '사용 가능한 미팅룸이 없습니다.',
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      const roomsWithAvailability = await Promise.all(
        availableRooms.map(async (room) => ({
          room,
          availableUntil: await getRoomAvailableUntil(room, intent.parsedTime),
        })),
      );

      const bookingId = generateBookingId();
      const booking: PendingBooking = {
        id: bookingId,
        startTime: intent.parsedTime,
        capacity: minCapacity,
        attendees: [],
        channelId: event.channel,
        userId: event.user,
      };
      pendingBookings.set(bookingId, booking);

      setTimeout(() => {
        pendingBookings.delete(bookingId);
      }, 5 * 60 * 1000);

      await client.chat.postEphemeral({
        channel: event.channel,
        user: event.user,
        blocks: buildMentionResponse(
          roomsWithAvailability,
          bookingId,
          intent.parsedTime,
          intent.capacity,
        ) as KnownBlock[],
        text: '사용 가능한 미팅룸 목록입니다.',
        username: BOT_DISPLAY_NAME,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.';

      if (message === '이미 지난 시간입니다') {
        await client.chat.postEphemeral({
          channel: event.channel,
          user: event.user,
          blocks: buildTimeErrorResponse(message) as KnownBlock[],
          text: `⚠️ ${message}`,
          username: BOT_DISPLAY_NAME,
        });
        return;
      }

      logger.error('app_mention 처리 오류:', error);
      await client.chat.postEphemeral({
        channel: event.channel,
        user: event.user,
        text: `⚠️ ${message}`,
        username: BOT_DISPLAY_NAME,
      });
    }
  });
}
