import type { WebClient } from '@slack/web-api';
import { getDirectoryClient } from './google-auth.js';
import { env } from '../config/env.js';
import type { UserSearchResult } from '../types/index.js';

// Slack 사용자 목록 캐시 (30분 TTL)
interface SlackUserCache {
  users: UserSearchResult[];
  fetchedAt: number;
}

let slackUserCache: SlackUserCache | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

/**
 * 사용자 검색 (Slack 우선, 실패 시 Google Directory 폴백)
 * Slack은 도메인 상관없이 모든 사용자 검색 가능
 */
export async function searchUsers(
  query: string,
  slackClient?: WebClient,
): Promise<UserSearchResult[]> {
  if (query.length < 2) return [];

  // Slack + Google Directory 병렬 검색 후 병합
  const [slackResults, googleResults] = await Promise.all([
    slackClient
      ? searchUsersViaSlack(query, slackClient).catch((error) => {
          console.warn('Slack 사용자 검색 실패:', error instanceof Error ? error.message : String(error));
          return [] as UserSearchResult[];
        })
      : Promise.resolve([] as UserSearchResult[]),
    searchUsersViaGoogle(query).catch((error: unknown) => {
      const gaxErr = error as { response?: { data?: unknown }; code?: number; message?: string };
      const detail = gaxErr.response?.data ?? gaxErr.message ?? String(error);
      console.warn('Google Directory API 검색 실패:', JSON.stringify(detail));
      return [] as UserSearchResult[];
    }),
  ]);

  // 이메일 없는 Slack 사용자 → Google Directory에서 이름으로 이메일 보완
  const resolvedSlack: UserSearchResult[] = [];
  for (const user of slackResults) {
    if (user.email) {
      resolvedSlack.push(user);
    } else {
      // 이름으로 Google Directory 검색하여 이메일 찾기
      try {
        const googleMatch = await searchUsersViaGoogle(user.name);
        if (googleMatch.length > 0) {
          resolvedSlack.push({ ...user, email: googleMatch[0].email });
        }
      } catch {
        // Google 검색 실패 시 스킵
      }
    }
  }

  // 이메일 기준으로 중복 제거 (Slack 결과 우선)
  const seen = new Set<string>();
  const merged: UserSearchResult[] = [];

  for (const user of [...resolvedSlack, ...googleResults]) {
    const key = user.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(user);
    }
  }

  return merged;
}

/**
 * Google Workspace Directory API로 사용자 검색
 */
async function searchUsersViaGoogle(query: string): Promise<UserSearchResult[]> {
  const directory = getDirectoryClient();

  // 도메인 추출 (admin 이메일에서)
  const domain = env.google.adminEmail.split('@')[1];
  if (!domain) {
    throw new Error('GOOGLE_ADMIN_EMAIL에서 도메인을 추출할 수 없습니다.');
  }

  // Google Directory API query: 특수문자 제거, prefix 검색
  const sanitized = query.replace(/['":\\*]/g, '').trim();
  if (!sanitized) {
    return [];
  }

  const response = await directory.users.list({
    domain,
    query: `name:${sanitized}`,  // prefix match (쿼트 없이)
    maxResults: 10,
    orderBy: 'givenName',
    projection: 'basic',
  });

  const users = response.data.users ?? [];

  return users
    .filter((user) => user.primaryEmail != null && !user.suspended)
    .map((user) => ({
      name: user.name?.fullName ?? user.primaryEmail ?? '',
      email: user.primaryEmail!,
      photoUrl: user.thumbnailPhotoUrl ?? undefined,
    }));
}

/**
 * Slack users.list API로 사용자 검색 (캐싱 포함)
 */
export async function searchUsersViaSlack(
  query: string,
  client: WebClient,
): Promise<UserSearchResult[]> {
  // 캐시 확인
  const now = Date.now();
  if (!slackUserCache || now - slackUserCache.fetchedAt > CACHE_TTL_MS) {
    // 캐시 갱신
    const allUsers = await fetchAllSlackUsers(client);
    slackUserCache = { users: allUsers, fetchedAt: now };
  }

  const lowerQuery = query.normalize('NFC').toLowerCase();

  return slackUserCache.users
    .filter((user) =>
      user.name.normalize('NFC').toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      (user.searchText?.normalize('NFC').toLowerCase().includes(lowerQuery) ?? false),
    )
    .slice(0, 10);
}

/**
 * Slack 전체 사용자 목록 조회 (봇/삭제 사용자 제외)
 */
async function fetchAllSlackUsers(client: WebClient): Promise<UserSearchResult[]> {
  const results: UserSearchResult[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.users.list({
      limit: 200,
      cursor,
    });

    const members = response.members ?? [];

    for (const member of members) {
      // 봇, 삭제된 사용자, Slackbot 제외
      if (member.is_bot || member.deleted || member.id === 'USLACKBOT') continue;
      if (!member.profile) continue;

      // [DEBUG] 김재근 프로필 전체 로그 — 원인 파악 후 제거
      const allText = JSON.stringify(member.profile);
      if (allText.includes('김재근') || allText.includes('Jack')) {
        console.log(`🔍 [DEBUG] 김재근 프로필:`, JSON.stringify({
          id: member.id,
          name: member.name,
          real_name: member.profile.real_name,
          display_name: member.profile.display_name,
          display_name_normalized: member.profile.display_name_normalized,
          first_name: member.profile.first_name,
          last_name: member.profile.last_name,
          title: member.profile.title,
          email: member.profile.email,
          status_text: member.profile.status_text,
        }, null, 2));
      }

      // 검색 가능한 모든 이름 필드를 합쳐서 저장
      const nameParts = [
        member.profile.real_name,
        member.profile.display_name,
        member.profile.first_name,
        member.profile.last_name,
        member.profile.title,
        member.name,
      ].filter(Boolean);

      results.push({
        name: member.profile.real_name ?? member.name ?? '',
        email: member.profile.email ?? '',
        displayName: member.profile.display_name || undefined,
        searchText: nameParts.join(' '),
        photoUrl: member.profile.image_48 ?? undefined,
      });
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return results;
}

/**
 * 앱 시작 시 Slack 사용자 캐시를 사전 로드
 * options 핸들러의 3초 타임아웃 초과 방지
 */
export async function warmUpSlackUserCache(client: WebClient): Promise<void> {
  const allUsers = await fetchAllSlackUsers(client);
  slackUserCache = { users: allUsers, fetchedAt: Date.now() };
  console.log(`📋 Slack 사용자 캐시 사전 로드 완료: ${allUsers.length}명`);
}
