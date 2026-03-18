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

// Render 무료 티어용 헬스체크 HTTP 서버
const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

server.listen(PORT, () => {
  console.log(`🌐 헬스체크 서버 실행 중 (포트: ${PORT})`);
});

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
