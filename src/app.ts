import 'dotenv/config';
import http from 'node:http';
import { App, LogLevel } from '@slack/bolt';
import { env } from './config/env.js';
import { registerListeners } from './listeners/index.js';

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
  console.log('⚡ Slack 회의실 예약봇이 시작되었습니다!');
}).catch((error: unknown) => {
  console.error('앱 시작 실패:', error);
  process.exit(1);
});
