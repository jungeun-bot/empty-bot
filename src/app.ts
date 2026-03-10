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
// - Render가 이 포트로 앱 상태를 확인함
// - UptimeRobot이 14분마다 핑을 보내 잠들지 않게 유지
const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

server.listen(PORT, () => {
  console.log(`🌐 헬스체크 서버 실행 중 (포트: ${PORT})`);
});

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
