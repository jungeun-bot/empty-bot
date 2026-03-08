import type { WebClient } from '@slack/web-api';
import { getDirectoryClient } from './google-auth.js';
import { env } from '../config/env.js';
import type { UserSearchResult } from '../types/index.js';

// Slack 사용자 목록 캐시 (5분 TTL)
interface SlackUserCache {
  users: UserSearchResult[];
  fetchedAt: number;
}

let slackUserCache: SlackUserCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 사용자 검색 (Google Directory 우선, 실패 시 Slack 폴백)
 */
export async function searchUsers(
  query: string,
  slackClient?: WebClient,
): Promise<UserSearchResult[]> {
  if (query.length < 2) return [];

  // Google Directory API 시도
  try {
    return await searchUsersViaGoogle(query);
  } catch (error) {
    console.warn('Google Directory API 검색 실패, Slack으로 폴백:', error instanceof Error ? error.message : String(error));
  }

  // Slack 폴백
  if (slackClient) {
    try {
      return await searchUsersViaSlack(query, slackClient);
    } catch (error) {
      console.error('Slack 사용자 검색도 실패:', error instanceof Error ? error.message : String(error));
    }
  }

  return [];
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

  // Google Directory API query 문법에 맞게 특수문자 제거 + 싱글쿼트 래핑
  const sanitized = query.replace(/['":\\*]/g, '').trim();
  if (!sanitized) {
    return [];
  }

  const response = await directory.users.list({
    domain,
    query: `name:'${sanitized}'`,
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

  const lowerQuery = query.toLowerCase();

  return slackUserCache.users
    .filter((user) =>
      user.name.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery),
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
      if (!member.profile?.email) continue;

      results.push({
        name: member.profile.real_name ?? member.name ?? '',
        email: member.profile.email,
        photoUrl: member.profile.image_48 ?? undefined,
      });
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return results;
}
