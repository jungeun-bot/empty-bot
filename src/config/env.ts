import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ 필수 환경변수 누락: ${name}`);
    console.error(`   .env.example을 참고하여 .env 파일을 설정해주세요.`);
    process.exit(1);
  }
  return value;
}


export const env = {
  slack: {
    botToken: requireEnv('SLACK_BOT_TOKEN'),
    appToken: requireEnv('SLACK_APP_TOKEN'),
    signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
  },
  google: {
    serviceAccountKey: process.env['GOOGLE_SERVICE_ACCOUNT_KEY'],
    serviceAccountKeyPath: process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'],
    adminEmail: requireEnv('GOOGLE_ADMIN_EMAIL'),
    timezone: process.env['GOOGLE_CALENDAR_TIMEZONE'] ?? 'Asia/Seoul',
  },
  rooms: {
    config: process.env['ROOMS_CONFIG'],
  },
  admin: {
    slackUserId: process.env['ADMIN_SLACK_USER_ID'],
  },
} as const;

// Google 인증 설정 검증 (KEY 또는 KEY_PATH 중 하나 필요)
if (!env.google.serviceAccountKey && !env.google.serviceAccountKeyPath) {
  console.error('❌ Google 서비스 계정 설정 누락');
  console.error('   GOOGLE_SERVICE_ACCOUNT_KEY 또는 GOOGLE_SERVICE_ACCOUNT_KEY_PATH 중 하나를 설정해주세요.');
  process.exit(1);
}
