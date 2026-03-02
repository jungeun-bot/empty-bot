import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { buildSetupPanelMessage } from '../../views/setup-panel-message.js';

export function registerSetupBookingCommand(app: App): void {
  app.command('/setup-booking', async ({ command, ack, client, respond, logger }) => {
    await ack();

    try {
      const result = await client.chat.postMessage({
        channel: command.channel_id,
        blocks: buildSetupPanelMessage() as KnownBlock[],
        text: '🏢 회의실 예약 시스템',
      });

      if (result.ts) {
        try {
          await client.pins.add({
            channel: command.channel_id,
            timestamp: result.ts,
          });
        } catch (pinError: unknown) {
          const errorCode = (pinError as { data?: { error?: string } })?.data?.error;
          if (errorCode === 'already_pinned') {
            // 이미 고정됨 — 정상 처리
          } else if (errorCode === 'too_many_pins') {
            await respond({
              response_type: 'ephemeral',
              text: '⚠️ 이 채널의 고정 메시지가 너무 많아 핀 고정에 실패했습니다. 기존 핀을 정리해주세요. 메시지는 게시되었습니다.',
            });
            return;
          } else {
            throw pinError;
          }
        }
      }

      await respond({
        response_type: 'ephemeral',
        text: '✅ 예약 패널이 설치되었습니다!',
      });
    } catch (error: unknown) {
      const errorCode = (error as { data?: { error?: string } })?.data?.error;
      if (errorCode === 'not_in_channel' || errorCode === 'channel_not_found') {
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ 봇이 이 채널에 초대되어 있지 않습니다. 먼저 봇을 채널에 추가해주세요.',
        });
      } else {
        logger.error('/setup-booking 처리 오류:', error);
        await respond({
          response_type: 'ephemeral',
          text: '⚠️ 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        });
      }
    }
  });
}
