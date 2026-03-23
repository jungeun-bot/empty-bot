import type { App } from '@slack/bolt';
import { searchUsers } from '../../services/directory.js';

// 사용자별 최신 검색 쿼리 추적 (race condition 방지)
const latestQueryByUser = new Map<string, string>();

export function registerAttendeeOptions(app: App): void {
  app.options('attendees_input', async ({ ack, options, client, body }) => {
    const userId = body.user.id;
    const query = options.value ?? '';
    const lowerQuery = query.toLowerCase();

    // 이 사용자의 최신 쿼리로 등록
    latestQueryByUser.set(userId, query);

    try {
      const results: { text: { type: 'plain_text'; text: string; emoji: boolean }; value: string }[] = [];

      // 사용자그룹 검색 (항상 실행 — 입력 없어도 그룹 목록 표시)
      try {
        const groupResult = await client.usergroups.list({ include_disabled: false });
        const groups = (groupResult.usergroups ?? [])
          .filter((g) => g.date_delete === 0 && g.name && g.handle)
          .filter((g) =>
            lowerQuery.length === 0 ||
            g.name!.toLowerCase().includes(lowerQuery) ||
            g.handle!.toLowerCase().includes(lowerQuery),
          )
          .slice(0, 5);

        for (const g of groups) {
          results.push({
            text: { type: 'plain_text' as const, text: `👥 ${g.name} (@${g.handle})`, emoji: true },
            value: `group:${g.id}`,
          });
        }
      } catch {
        // 그룹 검색 실패 시 스킵 (스코프 미설정 등)
      }

      // Race condition 방지: 그룹 검색 후 stale 쿼리면 조기 종료
      if (latestQueryByUser.get(userId) !== query) {
        await ack({ options: [] });
        return;
      }

      // 개별 사용자 검색 (2글자 이상 입력 시)
      if (query.length >= 2) {
        const users = await searchUsers(query, client);
        const maxUsers = Math.max(10 - results.length, 5);

        for (const user of users.slice(0, maxUsers)) {
          results.push({
            text: { type: 'plain_text' as const, text: user.displayName || user.name, emoji: false },
            value: user.email,
          });
        }
      }

      // Race condition 방지: 최종 응답 전 다시 확인
      if (latestQueryByUser.get(userId) !== query) {
        await ack({ options: [] });
        return;
      }

      await ack({ options: results });
    } catch {
      // 전체 검색 실패 시 빈 목록 반환
      await ack({ options: [] });
    }
  });
}
