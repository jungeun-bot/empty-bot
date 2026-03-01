import type { WebClient } from '@slack/web-api';
import type { BookingEvent } from '../types/index.js';
import { formatDateTime } from '../views/common.js';

export interface BookingChanges {
  summary?: { before: string; after: string };
  startTime?: { before: Date; after: Date };
  endTime?: { before: Date; after: Date };
  room?: { before: string; after: string };
  attendees?: { before: string[]; after: string[] };
}

/**
 * 예약 변경 알림 — 모든 참석자에게 Slack DM 발송
 * 실패 시 에러 로깅만 (throw 안 함)
 */
export async function sendChangeNotification(
  client: WebClient,
  booking: BookingEvent,
  changes: BookingChanges,
): Promise<void> {
  const changeLines: string[] = [];

  if (changes.summary) {
    changeLines.push(`• 회의 이름: ${changes.summary.before} → ${changes.summary.after}`);
  }
  if (changes.startTime) {
    changeLines.push(`• 시작 시간: ${formatDateTime(changes.startTime.before)} → ${formatDateTime(changes.startTime.after)}`);
  }
  if (changes.endTime) {
    changeLines.push(`• 종료 시간: ${formatDateTime(changes.endTime.before)} → ${formatDateTime(changes.endTime.after)}`);
  }
  if (changes.room) {
    changeLines.push(`• 회의실: ${changes.room.before} → ${changes.room.after}`);
  }
  if (changes.attendees) {
    changeLines.push(`• 참석자: ${changes.attendees.before.join(', ')} → ${changes.attendees.after.join(', ')}`);
  }

  const message = `📝 *예약이 변경되었습니다*\n*회의:* ${booking.summary}\n\n*변경 내용:*\n${changeLines.join('\n')}`;

  await sendDmToAttendees(client, booking.attendees, message);
}

/**
 * 예약 취소 알림 — 모든 참석자에게 Slack DM 발송
 * 실패 시 에러 로깅만 (throw 안 함)
 */
export async function sendCancelNotification(
  client: WebClient,
  booking: BookingEvent,
): Promise<void> {
  const message = `🗑️ *예약이 취소되었습니다*\n*회의:* ${booking.summary}\n*일시:* ${formatDateTime(booking.startTime)} ~ ${formatDateTime(booking.endTime)}\n*회의실:* ${booking.roomName}`;

  await sendDmToAttendees(client, booking.attendees, message);
}

/**
 * 이메일 목록으로 Slack DM 발송
 * 각 이메일을 userId로 변환 후 DM 전송
 * 실패 시 에러 로깅만 (throw 안 함)
 */
async function sendDmToAttendees(
  client: WebClient,
  emails: string[],
  message: string,
): Promise<void> {
  for (const email of emails) {
    try {
      const result = await client.users.lookupByEmail({ email });
      const userId = result.user?.id;
      if (!userId) continue;

      await client.chat.postMessage({
        channel: userId,
        text: message,
      });
    } catch (error) {
      // DM 전송 실패 시 에러 로깅만 (throw 안 함)
      console.error(`DM 전송 실패 (${email}):`, error instanceof Error ? error.message : String(error));
    }
  }
}
