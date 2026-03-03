import type { WebClient } from '@slack/web-api';
import type { ConversationState, ConversationStage, Attendee, Room, RoomType, BookingRequest, BookingEvent } from '../types/index.js';
import { searchUsers } from './directory.js';
import { getAvailableRooms, createBooking, listRoomEvents, cancelBooking } from './calendar.js';
import { parseCapacity, parseAttendeeNames, parseDatePart } from './message-parser.js';
import { formatDateTime } from '../views/common.js';
import { sendCancelNotification } from './notification.js';
import { getRoomsByType } from '../config/rooms.js';

// 상태 저장소
const conversations = new Map<string, ConversationState>();
const editBookingsCache = new Map<string, BookingEvent[]>();

function getKey(userId: string, channelId: string): string {
  return `${userId}-${channelId}`;
}

// 상태 관리 함수들
export function getConversation(userId: string, channelId: string): ConversationState | undefined {
  return conversations.get(getKey(userId, channelId));
}

export function startConversation(
  userId: string,
  channelId: string,
  roomType: RoomType,
  parsedTime: Date,
  endTime: Date,
  capacity?: number,
  attendees?: Attendee[],
  stage: ConversationStage = 'waiting_info',
): ConversationState {
  const state: ConversationState = {
    userId,
    channelId,
    stage,
    roomType,
    parsedTime,
    endTime,
    capacity,
    attendees,
    createdAt: Date.now(),
  };
  const key = getKey(userId, channelId);
  conversations.set(key, state);
  // 5분 후 자동 만료
  setTimeout(() => conversations.delete(key), 5 * 60 * 1000);
  return state;
}

export function updateConversation(
  userId: string,
  channelId: string,
  updates: Partial<ConversationState>,
): ConversationState | undefined {
  const key = getKey(userId, channelId);
  const existing = conversations.get(key);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  conversations.set(key, updated);
  return updated;
}

export function clearConversation(userId: string, channelId: string): void {
  conversations.delete(getKey(userId, channelId));
}

// 응답 메시지 생성 함수들
export function buildInfoPrompt(): string {
  return '참석자 이름을 알려주세요. (본인 제외)\n참석자에게 구글 캘린더 초대장이 자동 발송됩니다.\n예: 홍길동, 김철수\n참석자가 없으면 "없음" 또는 "혼자"라고 입력하세요.';
}

export function buildTitlePrompt(): string {
  return '회의 이름을 알려주세요.\n예: 주간 미팅, 프로젝트 킥오프';
}

export function buildTitleRequired(): string {
  return '회의 이름을 입력해야 예약이 가능합니다. 회의 이름을 알려주세요.';
}

export function buildConfirmationMessage(state: ConversationState): string {
  const attendeeNames = state.attendees && state.attendees.length > 0
    ? state.attendees.map(a => a.name).join(', ')
    : '없음';
  const roomInfo = state.selectedRoom
    ? `${state.selectedRoom.name} (최대 ${state.selectedRoom.capacity}인)`
    : '미정';
  return `📋 예약 내용을 확인해주세요:\n• 일시: ${formatDateTime(state.parsedTime)} ~ ${formatDateTime(state.endTime)}\n• 미팅룸: ${roomInfo}\n• 인원: ${state.capacity ?? '미정'}명\n• 참석자: ${attendeeNames}\n• 회의 이름: ${state.meetingTitle ?? '미정'}\n\n예약하시겠습니까? ("예약해줘" 또는 "취소")`;
}

export function buildSuccessMessage(state: ConversationState): string {
  const attendeeNames = state.attendees && state.attendees.length > 0
    ? state.attendees.map(a => a.name).join(', ')
    : '없음';
  const roomInfo = state.selectedRoom ? state.selectedRoom.name : '미정';
  return `✅ *예약이 완료되었습니다!*\n*회의 이름:* ${state.meetingTitle ?? '(없음)'}\n*미팅룸:* ${roomInfo}\n*일시:* ${formatDateTime(state.parsedTime)} ~ ${formatDateTime(state.endTime)}\n*참석자:* ${attendeeNames}\n\n구글 캘린더 초대장이 발송되었습니다.`;
}

export function buildCancelMessage(): string {
  return '예약이 취소되었습니다.';
}

export function buildNoRoomMessage(parsedTime: Date, capacity: number): string {
  return `😔 ${formatDateTime(parsedTime)}에 ${capacity}인 이상 수용 가능한 빈 미팅룸이 없습니다.`;
}

export function buildFocusRoomList(rooms: Room[]): string {
  const list = rooms.map((r, i) => `${i + 1}) ${r.name}`).join('\n');
  return `사용 가능한 포커스룸 목록입니다:
${list}

번호를 선택해주세요.`;
}

export function buildFocusCapacityWarning(): string {
  return '포커스룸은 1인용 공간입니다. 인원 설정이 필요 없습니다.';
}

// 자동 미팅룸 선택
export function selectBestRoom(rooms: Room[], capacity: number, type: RoomType = 'meeting'): Room | undefined {
  const filtered = rooms.filter(r => r.type === type && r.capacity >= capacity);
  filtered.sort((a, b) => a.capacity - b.capacity);
  return filtered[0];
}

// 공통 대화 처리 함수 (T7/T8에서 호출)
interface ConversationReplyParams {
  client: WebClient;
  userId: string;
  channelId: string;
  text: string;
  userEmail: string;
}

export async function processConversationReply(params: ConversationReplyParams): Promise<string> {
  const { client, userId, channelId, text, userEmail } = params;
  const state = getConversation(userId, channelId);
  if (!state) return '대화 세션이 만료되었습니다. 다시 시작해주세요.';

  switch (state.stage) {
    case 'waiting_info': {
      const ALONE_KEYWORDS = ['없음', '혼자', '나만', '나 혼자'];

      // 1. 혼자/없음 처리 — 사용자 지정 capacity 보존
      if (ALONE_KEYWORDS.some(kw => text.includes(kw))) {
        updateConversation(userId, channelId, {
          stage: 'waiting_title',
          capacity: state.capacity ?? 1,
          attendees: [],
        });
        return buildTitlePrompt();
      }

      // 2. 참석자 이름 파싱
      const names = parseAttendeeNames(text);

      // 3. 이름 없으면 재요청
      if (names.length === 0) {
        return '참석자 이름을 입력해주세요. 없으면 "없음"이라고 입력하세요.\n예: 홍길동, 김철수';
      }

      // 4. 이름 있으면 searchUsers 실행
      const attendees: Attendee[] = [];
      const pendingSelections: { name: string; results: { name: string; email: string }[] }[] = [];

      for (const name of names) {
        const results = await searchUsers(name, client);
        if (results.length === 0) {
          return `"${name}"을(를) 찾을 수 없습니다. 다시 입력해주세요.`;
        } else if (results.length === 1) {
          attendees.push({ name: results[0].name, email: results[0].email });
        } else {
          pendingSelections.push({ name, results });
        }
      }

      if (pendingSelections.length > 0) {
        const first = pendingSelections[0];
        const list = first.results.map((r, i) => `${i + 1}) ${r.name} (${r.email})`).join('\n');
        updateConversation(userId, channelId, {
          stage: 'waiting_attendee_selection',
          capacity: Math.max(attendees.length + pendingSelections.length + 1, state.capacity ?? 1),
          attendees,
          pendingSelections,
        });
        return `"${first.name}" 검색 결과:\n${list}\n번호를 선택해주세요.`;
      }

      // 5. 전원 확인됨 — 참석자 표시 후 제목 질문
      const resolvedCapacity = Math.max(attendees.length + 1, state.capacity ?? 1);
      updateConversation(userId, channelId, {
        stage: 'waiting_title',
        capacity: resolvedCapacity,
        attendees,
      });
      const attendeeList = attendees.map(a => `• ${a.name} (${a.email})`).join('\n');
      return `✅ 참석자가 등록되었습니다:\n${attendeeList}\n\n예약 확정 시 참석자에게 구글 캘린더 초대장이 자동 발송됩니다.\n\n${buildTitlePrompt()}`;
    }

    case 'waiting_attendee_selection': {
      const num = parseInt(text.trim(), 10);
      const pending = state.pendingSelections ?? [];
      const currentPending = pending[0];

      if (!currentPending) {
        updateConversation(userId, channelId, { stage: 'waiting_title' });
        return buildTitlePrompt();
      }

      if (isNaN(num) || num < 1 || num > currentPending.results.length) {
        return `1~${currentPending.results.length} 사이의 번호를 입력해주세요.`;
      }

      const selected = currentPending.results[num - 1]!;
      const updatedAttendees = [...(state.attendees ?? []), { name: selected.name, email: selected.email }];
      const remainingSelections = pending.slice(1);

      if (remainingSelections.length > 0) {
        const next = remainingSelections[0]!;
        const list = next.results.map((r, i) => `${i + 1}) ${r.name} (${r.email})`).join('\n');
        updateConversation(userId, channelId, {
          attendees: updatedAttendees,
          pendingSelections: remainingSelections,
        });
        return `"${next.name}" 검색 결과:\n${list}\n번호를 선택해주세요.`;
      }

      const finalCapacity = Math.max(updatedAttendees.length + 1, state.capacity ?? 1);
      updateConversation(userId, channelId, {
        stage: 'waiting_title',
        capacity: finalCapacity,
        attendees: updatedAttendees,
        pendingSelections: [],
      });
      const attendeeList = updatedAttendees.map(a => `• ${a.name} (${a.email})`).join('\n');
      return `✅ 참석자가 등록되었습니다:\n${attendeeList}\n\n예약 확정 시 참석자에게 구글 캘린더 초대장이 자동 발송됩니다.\n\n${buildTitlePrompt()}`;
    }

    case 'waiting_title': {
      const title = text.trim();
      if (!title) return buildTitleRequired();

      const capacity = state.capacity ?? 1;
      const availableRooms = await getAvailableRooms(state.parsedTime, state.endTime, capacity);
      const selectedRoom = selectBestRoom(availableRooms, capacity, state.roomType);

      if (!selectedRoom) {
        clearConversation(userId, channelId);
        return buildNoRoomMessage(state.parsedTime, capacity);
      }

      updateConversation(userId, channelId, {
        stage: 'waiting_confirmation',
        meetingTitle: title,
        selectedRoom,
      });

      const updated = getConversation(userId, channelId);
      return updated ? buildConfirmationMessage(updated) : buildTitleRequired();
    }

    case 'waiting_confirmation': {
      const CONFIRM_KEYWORDS = ['예약해줘', '네', '확인', '예', '응', '좋아', '해줘'];
      const CANCEL_KEYWORDS = ['취소', '아니', '아니요', '그만'];

      if (CANCEL_KEYWORDS.some(kw => text.includes(kw))) {
        clearConversation(userId, channelId);
        return buildCancelMessage();
      }

      if (CONFIRM_KEYWORDS.some(kw => text.includes(kw))) {
        if (!state.selectedRoom || !state.meetingTitle) {
          return '예약 정보가 불완전합니다. 다시 시작해주세요.';
        }

        const bookingRequest: BookingRequest = {
          room: state.selectedRoom,
          startTime: state.parsedTime,
          endTime: state.endTime,
          title: state.meetingTitle,
          attendees: state.attendees ?? [],
          organizer: userEmail,
        };

        await createBooking(bookingRequest);
        clearConversation(userId, channelId);
        return buildSuccessMessage(state);
      }

      return '예약하시겠습니까? "예약해줘" 또는 "취소"를 입력해주세요.';
    }

    case 'waiting_focus_select': {
      const num = parseInt(text.trim(), 10);

      // 포커스룸 목록 조회
      const availableFocus = await getAvailableRooms(state.parsedTime, state.endTime, 1);
      const availableFocusFiltered = availableFocus.filter(r => r.type === 'focus');

      if (availableFocusFiltered.length === 0) {
        clearConversation(userId, channelId);
        return '😔 해당 시간대에 사용 가능한 포커스룸이 없습니다.';
      }

      if (isNaN(num) || num < 1 || num > availableFocusFiltered.length) {
        return `1~${availableFocusFiltered.length} 사이의 번호를 입력해주세요.`;
      }

      const selectedFocusRoom = availableFocusFiltered[num - 1];
      updateConversation(userId, channelId, {
        stage: 'waiting_title',
        selectedRoom: selectedFocusRoom,
        capacity: 1,
        attendees: [],
      });
      return buildTitlePrompt();
    }

    case 'waiting_edit_date': {
      const parsedDate = parseDatePart(text, new Date());
      const meetingRooms = getRoomsByType('meeting');
      const roomList = meetingRooms.map((r, i) => `${i + 1}) ${r.name}`).join('\n');

      updateConversation(userId, channelId, {
        stage: 'waiting_edit_room',
        parsedTime: parsedDate,
        endTime: parsedDate,
      });

      return `어느 미팅룸의 예약을 수정/취소하시겠습니까?\n${roomList}\n\n번호를 입력해주세요.`;
    }

    case 'waiting_edit_room': {
      const num = parseInt(text.trim(), 10);
      const meetingRooms = getRoomsByType('meeting');

      if (isNaN(num) || num < 1 || num > meetingRooms.length) {
        return `1~${meetingRooms.length} 사이의 번호를 입력해주세요.`;
      }

      const selectedRoom = meetingRooms[num - 1]!;
      const bookings = await listRoomEvents(selectedRoom.id, state.parsedTime);
      const myBookings = bookings
        .filter(b => b.organizer === userEmail)
        .map(b => ({ ...b, roomName: selectedRoom.name }));

      if (myBookings.length === 0) {
        clearConversation(userId, channelId);
        return `${formatDateTime(state.parsedTime)}에 ${selectedRoom.name}에서 수정 가능한 예약이 없습니다.`;
      }

      const bookingList = myBookings.slice(0, 10).map((b, i) =>
        `${i + 1}) ${formatDateTime(b.startTime)} ~ ${formatDateTime(b.endTime)} | ${b.summary}`
      ).join('\n');

      updateConversation(userId, channelId, {
        stage: 'waiting_edit_select',
        selectedRoom,
      });

      editBookingsCache.set(getKey(userId, channelId), myBookings);

      return `예약 목록:\n${bookingList}\n\n번호를 선택하고 "수정" 또는 "취소"를 입력해주세요.\n예: "1번 취소", "2번 수정"`;
    }

    case 'waiting_edit_select': {
      const numMatch = text.match(/(\d+)/);
      const isCancelAction = text.includes('취소');
      const isEditAction = text.includes('수정');

      if (!numMatch || (!isCancelAction && !isEditAction)) {
        return '번호와 작업을 입력해주세요.\n예: "1번 취소", "2번 수정"';
      }

      const num = parseInt(numMatch[1]!, 10);
      const cachedBookings = editBookingsCache.get(getKey(userId, channelId)) ?? [];

      if (num < 1 || num > cachedBookings.length) {
        return `1~${cachedBookings.length} 사이의 번호를 입력해주세요.`;
      }

      const booking = cachedBookings[num - 1]!;

      if (isCancelAction) {
        await cancelBooking(booking.eventId, booking.roomId);
        await sendCancelNotification(client, booking);
        clearConversation(userId, channelId);
        editBookingsCache.delete(getKey(userId, channelId));
        return `🗑️ 예약이 취소되었습니다.\n*회의:* ${booking.summary}\n*일시:* ${formatDateTime(booking.startTime)} ~ ${formatDateTime(booking.endTime)}`;
      }

      clearConversation(userId, channelId);
      editBookingsCache.delete(getKey(userId, channelId));
      return `예약 수정은 \`/수정\` 커맨드를 사용해주세요. 더 편리하게 수정할 수 있습니다.`;
    }

    default:
      return '알 수 없는 상태입니다. 다시 시작해주세요.';
  }
}


// 포커스룸 대화 시작 헬퍼
export async function startFocusConversation(
  userId: string,
  channelId: string,
  parsedTime: Date,
  endTime: Date,
): Promise<string> {
  const availableRooms = await getAvailableRooms(parsedTime, endTime, 1);
  const focusRooms = availableRooms.filter(r => r.type === 'focus');

  if (focusRooms.length === 0) {
    return '😔 해당 시간대에 사용 가능한 포커스룸이 없습니다.';
  }

  startConversation(userId, channelId, 'focus', parsedTime, endTime, 1, [], 'waiting_focus_select');

  return buildFocusRoomList(focusRooms);
}

// 수정/취소 대화 시작 헬퍼
export function startEditConversation(
  userId: string,
  channelId: string,
): string {
  const now = new Date();
  const endTime = new Date(now.getTime() + 60 * 60 * 1000);
  startConversation(userId, channelId, 'meeting', now, endTime, undefined, undefined, 'waiting_edit_date');
  return '어느 날짜의 예약을 수정/취소하시겠습니까?\n예: 3월 5일, 내일, 3/5';
}