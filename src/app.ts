import 'dotenv/config';
import http from 'node:http';
import { App, LogLevel } from '@slack/bolt';
import { env } from './config/env.js';
import { registerListeners } from './listeners/index.js';
import { warmUpSlackUserCache } from './services/directory.js';
import { startNotificationScheduler } from './services/notification-scheduler.js';

const app = new App({
  token: env.slack.botToken,
  appToken: env.slack.appToken,
  signingSecret: env.slack.signingSecret,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

registerListeners(app);

// 앱 레벨 에러 핸들러 — 에러 로깅 및 치명적 에러 시 재시작
app.error(async (error) => {
  console.error('[APP ERROR]', error);
});

// 프로세스 레벨 에러 핸들러 — 미처리 에러로 인한 무응답 방지
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  process.exit(1);
});

// Render 무료 티어용 헬스체크 HTTP 서버
const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

server.listen(PORT, () => {
  console.log(`🌐 헬스체크 서버 실행 중 (포트: ${PORT})`);
});

// Socket Mode 연결 상태 모니터링
// HTTP 서버가 살아있어도 WebSocket 연결이 끊기면 Slack 메시지를 받지 못함
// → 연결 끊김 감지 시 프로세스 종료하여 Render가 자동 재시작하도록 함
let socketAlive = false;

function startSocketMonitor(): void {
  // 5분마다 Socket Mode 연결 상태 확인
  setInterval(async () => {
    try {
      // auth.test로 Slack API 연결 확인
      const result = await app.client.auth.test();
      if (result.ok) {
        socketAlive = true;
        return;
      }
    } catch {
      // API 호출 실패
    }

    if (socketAlive) {
      // 이전에는 살아있었는데 지금 실패 → 연결 끊김
      console.error('❌ Slack 연결 끊김 감지 — 프로세스 재시작');
      process.exit(1);
    }
  }, 5 * 60 * 1000);
}

// 셀프 핑: Render 슬립 방지 (10분 간격)
// Render가 자동 제공하는 RENDER_EXTERNAL_URL 사용, 프로덕션에서만 동작
const SELF_URL = process.env['RENDER_EXTERNAL_URL'];
if (SELF_URL) {
  const PING_INTERVAL = 10 * 60 * 1000; // 10분
  setInterval(() => {
    fetch(`${SELF_URL}/health`).catch(() => {});
  }, PING_INTERVAL);
  console.log(`🏓 셀프 핑 활성화 (${SELF_URL}/health, 10분 간격)`);
}

app.start().then(() => {
  console.log('⚡ Slack 미팅룸 예약봇이 시작되었습니다!');
  socketAlive = true;

  // Socket Mode 연결 모니터링 시작
  startSocketMonitor();

  // Slack 사용자 캐시 사전 로드 (options 핸들러 3초 타임아웃 방지)
  warmUpSlackUserCache(app.client).catch((err) =>
    console.warn('Slack 사용자 캐시 사전 로드 실패:', err),
  );
  // 회의 알림 스케줄러 시작
  startNotificationScheduler(app.client);
}).catch((error: unknown) => {
  console.error('앱 시작 실패:', error);
  process.exit(1);
});
