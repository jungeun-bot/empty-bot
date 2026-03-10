import type { WebClient } from '@slack/web-api';
import { ROOMS } from '../config/rooms.js';
import { listRoomEvents } from './calendar.js';
import { env, BOT_DISPLAY_NAME } from '../config/env.js';
import { formatTimeRange } from '../views/common.js';
import type { BookingEvent } from '../types/index.js';

/** 전송 완료된 알림 추적 (중복 방지) */
const sentNotifications = new Set<string>();

/**
 * 회의 알림 스케줄러 시작
 * 매 60초마다 모든 회의실의 일정을 조회하고,
 * 시작/종료 10분 전, 5분 전에 참석자에게 DM 알림을 보냅니다.
 */
export function startNotificationScheduler(client: WebClient): void {
  // 매분 실행
  setInterval(() => {
    checkUpcomingEvents(client).catch(err => {
      console.error('알림 스케줄러 오류:', err);
    });
  }, 60_000);

  // 매일 자정(KST)에 전송 기록 초기화
  scheduleDailyCleanup();

  // 앱 시작 시 즉시 1회 실행
  checkUpcomingEvents(client).catch(err => {
    console.error('알림 스케줄러 초기 실행 오류:', err);
  });

  console.log('🔔 회의 알림 스케줄러가 시작되었습니다.');
}

/** 매일 자정(KST)에 sentNotifications 초기화 */
function scheduleDailyCleanup(): void {
  const now = new Date();
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET);
  const kstMidnight = new Date(kstNow);
  kstMidnight.setUTCHours(0, 0, 0, 0);
  kstMidnight.setUTCDate(kstMidnight.getUTCDate() + 1);
  const msUntilMidnight = kstMidnight.getTime() - kstNow.getTime();

  setTimeout(() => {
    sentNotifications.clear();
    console.log('🔔 알림 전송 기록 초기화 완료');
    // 이후 24시간마다 반복
    setInterval(() => {
      sentNotifications.clear();
      console.log('🔔 알림 전송 기록 초기화 완료');
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

async function checkUpcomingEvents(client: WebClient): Promise<void> {
  const now = new Date();

  // 모든 회의실의 오늘 일정을 병렬 조회
  const results = await Promise.allSettled(
    ROOMS.map(async room => {
      const events = await listRoomEvents(room.id, now);
      // listRoomEvents는 roomName이 비어있을 수 있으므로 채워넣기
      for (const e of events) {
        if (!e.roomName) e.roomName = room.name;
      }
      return events;
    }),
  );

  const allEvents: BookingEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  }

  for (const event of allEvents) {
    // eventId가 없는 이벤트(freebusy fallback)는 알림 불가
    if (!event.eventId) continue;

    const startMs = event.startTime.getTime();
    const endMs = event.endTime.getTime();
    const nowMs = now.getTime();
    const durationMs = endMs - startMs;

    const minsToStart = (startMs - nowMs) / 60_000;
    const minsToEnd = (endMs - nowMs) / 60_000;

    // 알림 유형별 체크 (2분 윈도우로 60초 폴링 간격 커버)
    const notifications: Array<{ type: string; minutes: number; isEnd: boolean }> = [];

    // 시작 10분 전
    if (minsToStart >= 9 && minsToStart < 11) {
      notifications.push({ type: 'start-10', minutes: 10, isEnd: false });
    }
    // 시작 5분 전
    if (minsToStart >= 4 && minsToStart < 6) {
      notifications.push({ type: 'start-5', minutes: 5, isEnd: false });
    }
    // 종료 10분 전 (회의가 10분 초과일 때만)
    if (durationMs > 10 * 60_000 && minsToEnd >= 9 && minsToEnd < 11) {
      notifications.push({ type: 'end-10', minutes: 10, isEnd: true });
    }
    // 종료 5분 전 (회의가 5분 초과일 때만)
    if (durationMs > 5 * 60_000 && minsToEnd >= 4 && minsToEnd < 6) {
      notifications.push({ type: 'end-5', minutes: 5, isEnd: true });
    }

    for (const notif of notifications) {
      const key = `${event.eventId}:${notif.type}`;
      if (sentNotifications.has(key)) continue;
      sentNotifications.add(key);

      const timeRange = formatTimeRange(event.startTime, event.endTime);
      const roomLabel = event.roomName || '회의실';

      let message: string;
      if (notif.isEnd) {
        message = `⏰ *[${roomLabel}] ${event.summary}* 종료 ${notif.minutes}분 전입니다.\n🕐 ${timeRange}`;
      } else {
        message = `🔔 *[${roomLabel}] ${event.summary}* 이 ${notif.minutes}분 후에 시작됩니다.\n🕐 ${timeRange}`;
      }

      // 참석자에게 DM 전송 (리소스 캘린더, 관리자 제외)
      const attendeesToNotify = event.attendees.filter(
        email =>
          !email.includes('@resource.calendar.google.com') &&
          email !== env.google.adminEmail,
      );

      await sendNotificationDMs(client, attendeesToNotify, message);
    }
  }
}

/** 이메일 목록으로 Slack DM 발송 (알림용) */
async function sendNotificationDMs(
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
        username: BOT_DISPLAY_NAME,
      });
    } catch {
      // DM 전송 실패 시 무시 (사용자가 해당 워크스페이스에 없는 경우 등)
    }
  }
}
