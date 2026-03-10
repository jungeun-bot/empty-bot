import type { App } from '@slack/bolt';
import { buildBookModal } from '../../views/book-modal.js';
import { buildEndTimeModal } from '../../views/result-views.js';
import { getRoomById } from '../../config/rooms.js';

/**
 * 게스트 라디오 버튼 액션 핸들러
 * "있음" 선택 시 이메일 입력 필드 표시, "없음" 시 제거
 * 기존 입력값은 모두 보존
 */
export function registerGuestSelectAction(app: App): void {
  app.action('guest_select', async ({ ack, action, body, client, logger }) => {
    await ack();

    try {
      const hasGuests = (action as { selected_option?: { value?: string } }).selected_option?.value === 'yes';
      const viewId = (body as { view?: { id?: string } }).view?.id ?? '';
      if (!viewId) return;

      // callback_id 확인
      const callbackId = (body as { view?: { callback_id?: string } }).view?.callback_id ?? '';

      if (callbackId === 'now_book_end_time') {
        // /즉시예약 모달 처리
        let bookingId = '';
        let roomId = '';
        try {
          const meta = JSON.parse(
            (body as { view?: { private_metadata?: string } }).view?.private_metadata ?? '{}'
          ) as { bookingId?: string; roomId?: string };
          bookingId = meta.bookingId ?? '';
          roomId = meta.roomId ?? '';
        } catch { /* 무시 */ }

        const room = getRoomById(roomId);
        if (!room) return;

        // 현재 폼 값 읽기
        const values = (body as { view?: { state?: { values?: Record<string, Record<string, unknown>> } } })
          .view?.state?.values ?? {};

        const titleVal = values['title_block']?.['title_input'] as { value?: string } | undefined;
        const attendeesVal = values['attendees_block']?.['attendees_input'] as {
          selected_options?: Array<{ text: { type: 'plain_text'; text: string }; value: string }>;
        } | undefined;
        const guestEmailsVal = values['guest_emails_block']?.['guest_emails_input'] as { value?: string } | undefined;

        const modal = buildEndTimeModal(room, null, bookingId, {
          showGuestEmails: hasGuests,
          initialValues: {
            title: titleVal?.value ?? undefined,
            attendees: attendeesVal?.selected_options ?? undefined,
            guestEmails: guestEmailsVal?.value ?? undefined,
          },
        });

        await client.views.update({ view_id: viewId, view: modal });
        return;
      }

      // 현재 private_metadata 보존
      let channelId = '';
      let roomType = 'meeting';
      try {
        const meta = JSON.parse(
          (body as { view?: { private_metadata?: string } }).view?.private_metadata ?? '{}'
        ) as { channelId?: string; roomType?: string };
        channelId = meta.channelId ?? '';
        roomType = meta.roomType ?? 'meeting';
      } catch { /* 무시 */ }

      // 현재 폼 입력값 읽기
      const values = (body as { view?: { state?: { values?: Record<string, Record<string, unknown>> } } })
        .view?.state?.values ?? {};

      const titleVal = values['title_block']?.['title_input'] as { value?: string } | undefined;
      const dateVal = values['date_block']?.['date_input'] as { selected_date?: string } | undefined;
      const startVal = values['start_time_block']?.['start_time_input'] as {
        value?: string;
      } | undefined;
      const endVal = values['end_time_block']?.['end_time_input'] as {
        value?: string;
      } | undefined;
      const attendeesVal = values['attendees_block']?.['attendees_input'] as {
        selected_options?: Array<{ text: { type: 'plain_text'; text: string }; value: string }>;
      } | undefined;
      const guestEmailsVal = values['guest_emails_block']?.['guest_emails_input'] as { value?: string } | undefined;

      // 기존 값 보존하면서 모달 재구성
      const modal = buildBookModal(channelId, {
        showGuestEmails: hasGuests,
        initialValues: {
          title: titleVal?.value ?? undefined,
          date: dateVal?.selected_date ?? undefined,
          startTime: startVal?.value ?? undefined,
          endTime: endVal?.value ?? undefined,
          attendees: attendeesVal?.selected_options ?? undefined,
          guestEmails: guestEmailsVal?.value ?? undefined,
        },
      });

      // private_metadata에 roomType 보존
      modal.private_metadata = JSON.stringify({ channelId, roomType });

      await client.views.update({ view_id: viewId, view: modal });
    } catch (error) {
      logger.error('guest_select 처리 오류:', error);
    }
  });
}
