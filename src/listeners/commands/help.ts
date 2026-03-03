import type { App } from '@slack/bolt';

export function registerHelpCommand(app: App): void {
  app.command('/사용방법', async ({ command, ack, respond, logger }) => {
    await ack();

    try {
      await respond({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*🏢 미팅룸 예약봇 사용 가이드*',
            },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: [
                '*`/예약`*',
                '날짜, 시간, 참석자를 지정하여 미팅룸 또는 포커스룸을 예약하는 모달을 엽니다. 외부 게스트 이메일 초대도 가능합니다.',
                '',
                '*`/즉시예약`*',
                '현재 시각 기준으로 바로 사용 가능한 미팅룸을 조회하고, 한 번의 클릭으로 빠르게 예약합니다. (예: `/즉시예약 4`)',
                '',
                '*`/수정`*',
                '내가 등록한 기존 예약을 날짜별로 조회하여 회의 이름, 시간 등을 수정하거나 예약 자체를 취소할 수 있습니다.',
                '',
                '*`/신고`*',
                '회의실 이용 관련 건의사항, 불편사항을 관리자에게 전달합니다. 유형을 선택하고 상세 내용을 작성합니다.',
                '',
                '*`/설치`*',
                '현재 채널에 예약하기·수정/취소·신고 버튼이 포함된 예약 패널을 설치하고 고정합니다. (채널 관리자용)',
                '',
                '*`/사용방법`*',
                '지금 보고 있는 이 도움말을 표시합니다.',
              ].join('\n'),
            },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: [
                '*💬 자연어 예약*',
                '봇을 `@멘션`하거나 DM으로 대화하듯 예약할 수도 있습니다.',
                '예: "내일 오후 2시 4명 미팅룸 예약해줘"',
              ].join('\n'),
            },
          },
        ],
        text: '미팅룸 예약봇 사용 가이드',
      });
    } catch (error) {
      logger.error('/사용방법 처리 오류:', error);
    }
  });
}
