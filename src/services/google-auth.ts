import { google } from 'googleapis';
import { readFileSync } from 'fs';
import type { ServiceAccountCredentials } from '../types/index.js';

let cachedCredentials: ServiceAccountCredentials | null = null;

export function getServiceAccountCredentials(): ServiceAccountCredentials {
  if (cachedCredentials) return cachedCredentials;

  const inlineKey = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  const keyPath = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'];

  let raw: string;

  if (inlineKey) {
    raw = inlineKey;
  } else if (keyPath) {
    try {
      raw = readFileSync(keyPath, 'utf-8');
    } catch {
      throw new Error(`🔑 서비스 계정 키 파일을 읽을 수 없습니다: ${keyPath}`);
    }
  } else {
    throw new Error('🔑 GOOGLE_SERVICE_ACCOUNT_KEY 또는 GOOGLE_SERVICE_ACCOUNT_KEY_PATH를 설정해주세요.');
  }

  const parsed = JSON.parse(raw) as ServiceAccountCredentials;
  // JSON에서 이스케이프된 \n을 실제 개행으로 변환 (필수!)
  parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  cachedCredentials = parsed;
  return cachedCredentials;
}

export function getGoogleAuth(scopes: string[], subject?: string) {
  const credentials = getServiceAccountCredentials();
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
    subject,
  });
}

export function getCalendarClient() {
  const auth = getGoogleAuth([
    'https://www.googleapis.com/auth/calendar',
  ]);
  return google.calendar({ version: 'v3', auth });
}

export function getCalendarClientForUser(userEmail: string) {
  const auth = getGoogleAuth(
    ['https://www.googleapis.com/auth/calendar'],
    userEmail,
  );
  return google.calendar({ version: 'v3', auth });
}

export function getDirectoryClient() {
  const adminEmail = process.env['GOOGLE_ADMIN_EMAIL'];
  if (!adminEmail) {
    throw new Error('🔑 GOOGLE_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.');
  }
  const auth = getGoogleAuth(
    ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
    adminEmail,
  );
  return google.admin({ version: 'directory_v1', auth });
}

export function getResourceClient() {
  const adminEmail = process.env['GOOGLE_ADMIN_EMAIL'];
  if (!adminEmail) {
    throw new Error('🔑 GOOGLE_ADMIN_EMAIL 환경변수가 설정되지 않았습니다.');
  }
  const auth = getGoogleAuth(
    [
      'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
      'https://www.googleapis.com/auth/admin.directory.resource.calendar',
    ],
    adminEmail,
  );
  return google.admin({ version: 'directory_v1', auth });
}

export function getGoogleSheetsClient() {
  // Sheets API는 특정 스프레드시트 1개만 접근하므로 도메인 위임(DWD) 불필요
  // 서비스 계정 직접 인증 사용 → 스프레드시트에 서비스 계정 이메일을 편집자로 공유 필요
  const auth = getGoogleAuth([
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
  return google.sheets({ version: 'v4', auth });
}
