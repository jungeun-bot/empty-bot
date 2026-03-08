import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { listRoomEvents } from '../../services/calendar.js';
import { ROOMS, getRoomById } from '../../config/rooms.js';
import { buildProcessingView, buildErrorView } from '../../views/result-views.js';

function formatKSTTime(date: Date): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function registerStatusSubmit(app: App): void {
  app.view('status_modal', async ({ ack, body, view, client, logger }) => {
    await ack({ response_action: 'update', view: buildProcessingView() });

    try {
      const values = view.state.values;
      const dateStr = values['date_block']?.['date_input']?.selected_date ?? '';
      const roomId = values['room_block']?.['room_input']?.selected_option?.value ?? 'all';

      const date = new Date(`${dateStr}T00:00:00+09:00`);

      const targetRooms = roomId === 'all'
        ? ROOMS
        : (() => {
            const room = getRoomById(roomId);
            return room ? [room] : [];
          })();

      const eventsPerRoom = await Promise.all(
        targetRooms.map(async (room) => ({
          room,
          events: await listRoomEvents(room.id, date),
        })),
      );

      const blocks: KnownBlock[] = [
        {
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `📅 *${dateStr} 예약 현황*`,
          },
        },
        { type: 'divider' as const },
      ];

      for (const { room, events } of eventsPerRoom) {
        const icon = room.type === 'meeting' ? '🏢' : '🎯';
        blocks.push({
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `${icon} *${room.name}* (${room.capacity}인)`,
          },
        });

        if (events.length === 0) {
          blocks.push({
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: '  예약 없음 ✅',
            },
          });
        } else {
          const lines = events.map(
            (ev) =>
              `• ${formatKSTTime(ev.startTime)} ~ ${formatKSTTime(ev.endTime)}  ${ev.summary}`,
          );
          blocks.push({
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: lines.join('\n'),
            },
          });
        }

        blocks.push({ type: 'divider' as const });
      }

      const resultModal = {
        type: 'modal' as const,
        title: { type: 'plain_text' as const, text: '📊 예약 현황', emoji: true },
        close: { type: 'plain_text' as const, text: '닫기', emoji: true },
        blocks,
      };

      await client.views.update({
        view_id: body.view?.id ?? '',
        view: resultModal,
      });
    } catch (error) {
      logger.error('status_modal 처리 오류:', error);
      const message =
        error instanceof Error ? error.message : '예약 현황 조회 중 오류가 발생했습니다.';
      try {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView(message),
        });
      } catch {
        // views.update 실패 무시
      }
    }
  });
}
