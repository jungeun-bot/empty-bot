import type { App } from '@slack/bolt';
import type { Attendee, BookingRequest } from '../../types/index.js';
import { getAvailableRooms, createBooking } from '../../services/calendar.js';
import { selectBestRoom } from '../../services/conversation.js';
import { buildProcessingView, buildErrorView } from '../../views/result-views.js';
import { parseDateTimeString, formatDateTime } from '../../views/common.js';
import { BOT_DISPLAY_NAME } from '../../config/env.js';

// 요일 매핑: Date.getDay() → RRULE BYDAY
const DAY_MAP: Record<number, string> = {
  0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
};

const DAY_NAMES: Record<string, string> = {
  weekly: '매주',
  biweekly: '격주',
  weekdays: '매일 (평일)',
  monthly: '매월',
};

/**
 * RRULE 문자열 생성
 * @param frequency - weekly | biweekly | weekdays | monthly
 * @param startDate - 첫 회의 날짜 (KST Date)
 * @param untilDate - 반복 종료일 (YYYY-MM-DD)
 */
function buildRRule(frequency: string, startDate: Date, untilDate: string): string {
  const until = untilDate.replace(/-/g, '') + 'T235959Z';

  switch (frequency) {
    case 'weekly': {
      const day = DAY_MAP[startDate.getDay()];
      return `RRULE:FREQ=WEEKLY;BYDAY=${day};UNTIL=${until}`;
    }
    case 'biweekly': {
      const day = DAY_MAP[startDate.getDay()];
      return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${day};UNTIL=${until}`;
    }
    case 'weekdays': {
      return `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${until}`;
    }
    case 'monthly': {
      const dayOfMonth = startDate.getDate();
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};UNTIL=${until}`;
    }
    default:
      throw new Error(`지원하지 않는 반복 주기: ${frequency}`);
  }
}

/** 반복 주기 요약 텍스트 생성 */
function formatRecurrenceSummary(frequency: string, startDate: Date, untilDate: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[startDate.getDay()];
  const label = DAY_NAMES[frequency] ?? frequency;

  switch (frequency) {
    case 'weekly':
      return `${label} ${dayName}요일, ${untilDate}까지`;
    case 'biweekly':
      return `${label} ${dayName}요일, ${untilDate}까지`;
    case 'weekdays':
      return `${label}, ${untilDate}까지`;
    case 'monthly':
      return `${label} ${startDate.getDate()}일, ${untilDate}까지`;
    default:
      return `${label}, ${untilDate}까지`;
  }
}

export function registerRecurringSubmit(app: App): void {
  app.view('recurring_modal', async ({ ack, view, body, client, logger }) => {
    // 즉시 "처리 중" 화면으로 업데이트
    await ack({
      response_action: 'update',
      view: buildProcessingView(),
    });

    try {
      const values = view.state.values;

      // ── private_metadata에서 channelId 추출 ──
      let channelId = '';
      try {
        const meta = JSON.parse(view.private_metadata ?? '{}') as { channelId?: string };
        channelId = meta.channelId ?? '';
      } catch { /* 무시 */ }

      // ── 폼 값 추출 ──
      const roomType = (values['room_type_block']?.['recurring_type_select']?.selected_option?.value ?? 'meeting') as 'meeting' | 'focus';
      const meetingTitle = values['title_block']?.['title_input']?.value ?? '';
      const dateStr = values['date_block']?.['date_input']?.selected_date;
      const startTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value;
      const endTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value;
      const frequency = values['frequency_block']?.['frequency_input']?.selected_option?.value;
      const untilDateStr = values['until_block']?.['until_input']?.selected_date;

      // ── 필수값 검증 ──
      if (!dateStr || !startTimeStr || !endTimeStr || !frequency || !untilDateStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('필수 항목을 모두 입력해주세요.'),
        });
        return;
      }

      const startTime = parseDateTimeString(dateStr, startTimeStr);
      const endTime = parseDateTimeString(dateStr, endTimeStr);

      // ── 시간 유효성 검증 ──
      const now = new Date();
      if (startTime <= now) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('시작 시간은 현재 시각 이후여야 합니다.'),
        });
        return;
      }

      if (endTime <= startTime) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('종료 시간은 시작 시간 이후여야 합니다.'),
        });
        return;
      }

      // ── 반복 종료일 검증 ──
      if (untilDateStr <= dateStr) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('반복 종료일은 첫 회의 날짜 이후여야 합니다.'),
        });
        return;
      }

      // ── 매일(평일) 선택 시 시작일이 평일인지 검증 ──
      if (frequency === 'weekdays') {
        const dow = startTime.getDay();
        if (dow === 0 || dow === 6) {
          await client.views.update({
            view_id: body.view?.id ?? '',
            view: buildErrorView('매일(평일) 반복 시 첫 회의 날짜는 평일이어야 합니다.'),
          });
          return;
        }
      }

      // ── 예약자 정보 조회 ──
      let organizerEmail = '';
      let organizerName = '';
      try {
        const userInfo = await client.users.info({ user: body.user.id });
        organizerEmail = userInfo.user?.profile?.email ?? '';
        organizerName = userInfo.user?.profile?.real_name ?? '';
      } catch { /* 무시 */ }

      if (!organizerEmail) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView('예약자 이메일을 조회할 수 없습니다. 관리자에게 문의하세요.'),
        });
        return;
      }

      // ── 참석자 파싱 ──
      const selectedOptions = values['attendees_block']?.['attendees_input']?.selected_options ?? [];
      const groupSelections = selectedOptions.filter((opt) => opt.value.startsWith('group:'));
      const userSelections = selectedOptions.filter((opt) => !opt.value.startsWith('group:'));

      const groupAttendees: Attendee[] = [];
      for (const group of groupSelections) {
        const groupId = group.value.replace('group:', '');
        try {
          const membersResult = await client.usergroups.users.list({ usergroup: groupId });
          const memberIds = membersResult.users ?? [];
          const memberInfos = await Promise.all(
            memberIds.map(async (userId) => {
              try {
                const info = await client.users.info({ user: userId });
                const email = info.user?.profile?.email;
                const name = info.user?.profile?.real_name ?? info.user?.name ?? '';
                if (email) return { name, email };
              } catch { /* 스킵 */ }
              return null;
            }),
          );
          for (const info of memberInfos) {
            if (info) groupAttendees.push(info);
          }
        } catch { /* 그룹 조회 실패 스킵 */ }
      }

      const individualAttendees: Attendee[] = userSelections.map((opt) => ({
        name: opt.text.text,
        email: opt.value,
      }));

      const guestEmailsRaw = values['guest_emails_block']?.['guest_emails_input']?.value ?? '';
      const guestAttendees: Attendee[] = guestEmailsRaw
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'))
        .map((email) => ({ name: email.split('@')[0], email }));

      // 중복 제거 (예약자 본인 제외)
      const allCandidates = [...groupAttendees, ...individualAttendees, ...guestAttendees];
      const uniqueEmails = new Set<string>();
      const attendees: Attendee[] = [];
      for (const a of allCandidates) {
        if (a.email !== organizerEmail && !uniqueEmails.has(a.email)) {
          uniqueEmails.add(a.email);
          attendees.push(a);
        }
      }

      const capacity = roomType === 'focus' ? 1 : Math.max(attendees.length + 1, 1);

      // ── 가용 미팅룸 조회 (첫 회차 기준) + 자동 선택 ──
      const availableRooms = await getAvailableRooms(startTime, endTime, capacity);
      const selectedRoom = selectBestRoom(availableRooms, capacity, roomType);

      if (!selectedRoom) {
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView(`😔 ${formatDateTime(startTime)}에 ${capacity}인 이상 수용 가능한 빈 ${roomType === 'focus' ? '포커스룸' : '미팅룸'}이 없습니다.`),
        });
        return;
      }

      // ── RRULE 생성 ──
      // startTime은 KST 기준이지만 내부적으로 UTC Date.
      // RRULE의 BYDAY는 KST 요일 기준이어야 하므로 KST Date로 변환 후 계산
      const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const startKST = new Date(startTime.getTime() + KST_OFFSET_MS);
      const rrule = buildRRule(frequency, startKST, untilDateStr);

      // ── 예약 생성 (반복 이벤트) ──
      const bookingRequest: BookingRequest = {
        room: selectedRoom,
        startTime,
        endTime,
        title: meetingTitle || '정기 회의',
        attendees,
        organizer: organizerEmail,
        organizerName,
        recurrence: [rrule],
      };

      const eventId = await createBooking(bookingRequest);
      logger.info(`정기 회의 예약 완료: eventId=${eventId}, room=${selectedRoom.name}, rrule=${rrule}`);

      // ── 처리 중 모달 닫기 (clear) ──
      await client.views.update({
        view_id: body.view?.id ?? '',
        view: {
          type: 'modal' as const,
          callback_id: 'recurring_done',
          title: { type: 'plain_text' as const, text: '예약 완료', emoji: true },
          close: { type: 'plain_text' as const, text: '닫기', emoji: true },
          blocks: [
            {
              type: 'section' as const,
              text: { type: 'mrkdwn' as const, text: '✅ 정기 회의가 예약되었습니다!' },
            },
          ],
        },
      });

      // ── 채널에 결과 메시지 전송 ──
      const attendeeNames = attendees.length > 0
        ? attendees.map(a => a.name).join(', ')
        : '없음';

      const recurrenceSummary = formatRecurrenceSummary(frequency, startKST, untilDateStr);

      await client.chat.postMessage({
        channel: channelId || body.user.id,
        text: `🔁 *정기 회의가 예약되었습니다!*\n*회의 이름:* ${meetingTitle || '정기 회의'}\n*미팅룸:* ${selectedRoom.name} (최대 ${selectedRoom.capacity}인)\n*첫 회의:* ${formatDateTime(startTime)} ~ ${formatDateTime(endTime)}\n*반복:* ${recurrenceSummary}\n*참석자:* ${attendeeNames}\n\n구글 캘린더에 반복 일정이 생성되었으며, 참석자에게 초대장이 발송되었습니다.`,
        username: BOT_DISPLAY_NAME,
      });
    } catch (error) {
      logger.error('recurring_modal 제출 처리 오류:', error);
      try {
        const errorMessage = error instanceof Error ? error.message : '⚠️ 정기 회의 예약 중 오류가 발생했습니다.';
        await client.views.update({
          view_id: body.view?.id ?? '',
          view: buildErrorView(errorMessage),
        });
      } catch { /* 업데이트 실패 무시 */ }
    }
  });
}
