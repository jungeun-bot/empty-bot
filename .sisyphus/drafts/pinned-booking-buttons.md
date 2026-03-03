# Draft: 채널 고정 메시지 - 예약/변경/취소 버튼

## Requirements (confirmed)
- 채널 진입 시 항상 보이는 고정 메시지에 예약/변경/취소 버튼 배치
- 버튼 클릭 → 기존 Bolt 모달 UI 재활용
- 기존 슬랙봇(Bolt Node.js/TypeScript)과 연동
- Render 호스팅

## Codebase Analysis (완료)

### 기존 구조
- **언어**: TypeScript (ESM, strict mode)
- **프레임워크**: @slack/bolt v4.1.0, Socket Mode
- **스토리지**: Google Calendar (서비스 계정)
- **패턴**: `listeners/{commands|views|actions|events|options|functions}/` 모듈 분리

### 기존 슬래시 커맨드
- `/book` → `buildBookModal(channelId)` 모달 오픈
- `/edit` → `buildDateRoomSelectModal()` 모달 오픈 (수정 + 취소 통합)
- `/now-book N` → 현재 가용 회의실 즉시 표시

### 기존 Workflow Functions (listeners/functions/)
- `book_room`: 예약 생성
- `edit_booking`: 예약 수정
- `cancel_booking`: 예약 취소

### 핵심 뷰 빌더 (재활용 대상)
- `views/book-modal.ts` → `buildBookModal(channelId)`
- `views/edit-modal.ts` → `buildDateRoomSelectModal()`
- `views/result-views.ts` → 성공/에러/처리중 뷰

### 핵심 서비스
- `services/calendar.ts` → CRUD (getAvailableRooms, createBooking, updateBooking, cancelBooking, listRoomEvents)
- `services/notification.ts` → 변경/취소 알림

## Technical Decisions
- **접근방식**: Bolt 모달 UI + 채널 고정(Pin) 메시지
- **버튼 구성**: 예약 / 수정/취소 (기존 /edit가 수정+취소 통합이므로)
- **구현 방식**: 새 액션 핸들러 + 고정 메시지 셋업 커맨드

## Implementation Plan

### 필요한 새 코드
1. **셋업 커맨드** (`/setup-booking`): 채널에 Block Kit 버튼 메시지 게시 + 핀 고정
2. **액션 핸들러**: 버튼 클릭 시 기존 모달 열기
   - `pinned_book_action` → `buildBookModal(channelId)` 오픈
   - `pinned_edit_action` → `buildDateRoomSelectModal()` 오픈
3. **고정 메시지 뷰 빌더**: 예쁜 Block Kit 메시지 구성

### 기존 코드 수정
- `listeners/commands/index.ts` → 새 커맨드 등록
- `listeners/actions/index.ts` → 새 액션 등록

## Scope Boundaries
- INCLUDE: 고정 메시지 + 버튼 액션 핸들러 + 셋업 커맨드
- EXCLUDE: 기존 예약/수정/취소 로직 변경 없음, 새 DB 없음

## Test Strategy
- 인프라 없음 (테스트 프레임워크 미설치)
- Agent QA로 검증 (빌드 성공 확인)
