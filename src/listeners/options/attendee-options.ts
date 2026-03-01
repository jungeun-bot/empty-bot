import type { App } from '@slack/bolt';
import { searchUsers } from '../../services/directory.js';

export function registerAttendeeOptions(app: App): void {
  app.options('attendees_input', async ({ ack, options, client }) => {
    const query = options.value ?? '';

    if (query.length < 3) {
      await ack({ options: [] });
      return;
    }

    try {
      const users = await searchUsers(query, client);

      await ack({
        options: users.map((user) => ({
          text: {
            type: 'plain_text' as const,
            text: user.name,
            emoji: false,
          },
          value: user.email,
        })),
      });
    } catch (error) {
      // 검색 실패 시 빈 목록 반환
      await ack({ options: [] });
    }
  });
}
