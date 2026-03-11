// Room 인터페이스
export interface Room {
  id: string;           // Google Calendar 리소스 이메일 (예: room-a@resource.calendar.google.com)
  name: string;         // 표시 이름 (예: "미팅룸 A")
  capacity: number;     // 수용 인원
  type: RoomType;       // 방 타입 (meeting 또는 focus)
}

// 예약 요청 파라미터
export interface BookingRequest {
  room: Room;
  startTime: Date;
  endTime: Date;
  title: string;
  attendees: Attendee[];
  organizer: string; // 예약자 이메일
  organizerName?: string; // 예약자 이름 (Slack 표시명)
  recurrence?: string[]; // RRULE (정기 회의용, 예: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20251231T235959Z'])
}

// 참석자
export interface Attendee {
  email: string;
  name: string;
}

// 멤버 검색 결과
export interface UserSearchResult {
  name: string;
  email: string;
  photoUrl?: string;
}

// 대기 중인 예약 (모달→버튼 흐름에서 상태 유지)
export interface PendingBooking {
  id: string;
  startTime: Date;
  endTime?: Date;
  capacity: number;
  attendees: Attendee[];
  channelId: string;
  userId: string;
  availableRooms?: Room[];
  meetingTitle?: string;  // 회의 제목
  organizerEmail?: string; // 예약자 이메일 (중복 조회 방지용)
  organizerName?: string; // 예약자 이름
}

// Google 서비스 계정 키 구조
export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// @멘션 자연어 파싱 결과
export interface MentionIntent {
  parsedTime: Date;        // 파싱된 시작 시간
  endTime: Date;           // parsedTime + 1시간
  capacity: number | null; // 인원수 (없으면 null → 전체 표시)
  rawTimeText: string;     // 원본 시간 텍스트 (디버깅용)
  isBookingIntent: boolean; // 예약 의도 여부
  isEditIntent: boolean;    // 수정 의도 여부
  roomType?: RoomType;      // 요청한 방 타입
}

// 방 타입
export type RoomType = 'meeting' | 'focus';

// 대화 단계
export type ConversationStage =
  | 'waiting_info'
  | 'waiting_attendee_selection'
  | 'waiting_title'
  | 'waiting_confirmation'
  | 'waiting_edit_date'
  | 'waiting_edit_room'
  | 'waiting_edit_select'
  | 'waiting_focus_select';

// 대화 상태
export interface ConversationState {
  userId: string;
  channelId: string;
  stage: ConversationStage;
  roomType: RoomType;
  parsedTime: Date;
  endTime: Date;
  capacity?: number;
  attendees?: Attendee[];
  meetingTitle?: string;
  selectedRoom?: Room;
  createdAt: number;
  pendingSelections?: { name: string; results: { name: string; email: string }[] }[];
}

// 예약 이벤트
export interface BookingEvent {
  eventId: string;
  summary: string;
  startTime: Date;
  endTime: Date;
  organizer: string;
  creator: string;
  organizerSlackId?: string;
  attendees: string[];
  roomId: string;
  roomName: string;
  bookerEmail?: string;
  bookerName?: string;
  recurringEventId?: string;  // 정기회의 마스터 이벤트 ID (인스턴스인 경우)
}
