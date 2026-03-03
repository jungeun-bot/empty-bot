# /edit 커맨드 흐름 리팩토링 — 날짜 기반 전체 회의실 조회 + 포커싱룸 포함

## TL;DR

> **Quick Summary**: /edit 커맨드의 첫 모달에서 회의실 선택을 제거하고, 날짜만 선택하면 모든 회의실(meeting+focusing)에서 내 예약을 한번에 조회하도록 변경
> 
> **Deliverables**:
> - 날짜만 선택하는 간소화된 첫 모달
> - 모든 회의실(10개)을 병렬 조회하여 내 예약 목록 표시
> - 예약 목록에 회의실 이름 포함
> - 포커싱룸 예약도 수정/취소 가능
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO — 순차 (2개 태스크, 동일 파일 수정)
> **Critical Path**: Task 1 → Task 2 → Verification

---

## Context

### Original Request
사용자가 /edit로 예약을 수정/취소할 때:
1. 날짜+회의실을 선택하는 방식을 → 날짜만 선택하고 회의 이름으로 조회하는 방식으로 변경
2. 회의 목록은 내가 예약한 회의만 표시
3. 포커싱룸 수정/취소도 추가

### Interview Summary
**Key Discussions**:
- 사용자가 직접 요구사항을 명시함
- 포커싱룸이 수정/취소 흐름에서 빠져있는 것을 사용자가 발견

**Research Findings**:
- `buildDateRoomSelectModal()`에서 `getRoomsByType('meeting')`만 호출 → 포커싱룸 제외됨
- `listRoomEvents(roomId, date)`는 단일 룸 조회 → 10개 룸 병렬 호출 필요
- `BookingEvent.roomName`이 항상 `''` → handler에서 채워야 함
- Setup panel 버튼(`open_edit_modal`)도 같은 함수 호출 → 자동 반영

### Metis Review
**Identified Gaps** (addressed):
- `Promise.all` 대신 `Promise.allSettled` 사용 필요 (1개 룸 실패 시 전체 실패 방지)
- `roomName` 채우기 로직이 handler 1에서 필요
- 예약 목록 시간순 정렬 필요
- `buildBookingListModal` 시그니처에서 `roomId` 파라미터 제거 필요
- Handler 2에서 option value 파싱 방식 변경 필요

---

## Work Objectives

### Core Objective
/edit 커맨드의 첫 모달에서 회의실 선택을 제거하고, 날짜 선택만으로 모든 회의실(meeting+focusing)의 내 예약을 조회하도록 변경

### Concrete Deliverables
- 수정된 `src/views/edit-modal.ts`
- 수정된 `src/listeners/views/edit-submit.ts`

### Definition of Done
- [ ] `npx tsc --noEmit` → 에러 0개
- [ ] `npm run build` → 성공
- [ ] 봇 기동 테스트 → 크래시 없음

### Must Have
- 첫 모달: 날짜만 선택 (회의실 선택 제거)
- 모든 회의실(meeting 4개 + focusing 6개) 병렬 조회
- 내 예약만 필터링 (기존 동작 유지)
- 예약 목록에 회의실 이름 표시
- 예약 목록 시간순 정렬
- 수정/취소 모달(Modal 3, 4) 정상 작동 유지
- Setup panel 버튼에서도 정상 작동

### Must NOT Have (Guardrails)
- `calendar.ts` 수정 금지
- `conversation.ts` 수정 금지 (별도 @멘션 수정 흐름)
- `buildEditBookingModal()`, `buildCancelConfirmModal()` 수정 금지
- Handler 3 (`edit_booking_submit`), Handler 4 (`edit_cancel_confirm`) 수정 금지
- callback_id 변경 금지
- 회의실 유형별 그룹핑/헤더 추가 금지
- 캐싱/재시도 로직 추가 금지
- JSDoc 또는 과도한 주석 추가 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: N/A

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Sequential — same files):
├── Task 1: Modal 1 간소화 + Handler 1 리팩토링 + BookingListModal 업데이트 [unspecified-high]
└── Task 2: Handler 2 option value 파싱 변경 [quick]

Wave 2 (After Wave 1 — verification):
└── Task 3: 빌드 검증 + 무결성 확인 [quick]

Wave FINAL:
├── F1: Plan compliance audit [unspecified-high]
└── F2: Scope fidelity check [unspecified-high]
```

### Dependency Matrix
- **Task 1**: None — can start immediately
- **Task 2**: Depends on Task 1 (same files modified)
- **Task 3**: Depends on Task 2

---

## TODOs

- [ ] 1. Modal 1 간소화 + Handler 1 리팩토링 + BookingListModal 업데이트

  **What to do**:

  **A. `src/views/edit-modal.ts` 수정:**
  
  1. `import { ROOMS, getRoomById } from '../config/rooms.js';` 추가 (line 1 근처)
  2. `buildDateRoomSelectModal()` (line 35-98):
     - `const rooms = getRoomsByType('meeting');` 라인 삭제
     - `blocks` 배열에서 `room_block` 전체 제거 (line 74-95)
     - `date_block`만 남기기
  3. `buildBookingListModal()` (line 100-165):
     - 시그니처 변경: `(bookings: BookingEvent[], roomId: string)` → `(bookings: BookingEvent[])`
     - `const date = ...` 라인 유지 (line 101)
     - option text 변경 (line 104): 
       ```
       기존: `${formatDateTime(b.startTime)} ~ ${formatDateTime(b.endTime)} | ${b.summary}`
       변경: `[${b.roomName}] ${formatDateTime(b.startTime)} ~ ${formatDateTime(b.endTime)} | ${b.summary}`
       ```
     - option value 변경 (line 105):
       ```
       기존: b.eventId
       변경: `${b.roomId}::${b.eventId}`
       ```
     - `private_metadata` 변경 (line 131):
       ```
       기존: JSON.stringify({ roomId, date })
       변경: JSON.stringify({ date })
       ```

  **B. `src/listeners/views/edit-submit.ts` Handler 1 수정 (line 12-69):**

  1. 상단 import에 추가: `import { ROOMS, getRoomById } from '../../config/rooms.js';`
  2. `edit_date_room_select` handler 내부:
     - `roomId` 추출 코드 삭제 (line 21: `const roomId = ...`)
     - `if (!dateStr || !roomId)` → `if (!dateStr)` 로 변경
     - 에러 메시지 변경: `'날짜와 회의실을 선택해주세요.'` → `'날짜를 선택해주세요.'`
     - `listRoomEvents(roomId, date)` 단일 호출을 아래 병렬 호출로 교체:
       ```typescript
       const results = await Promise.allSettled(
         ROOMS.map(room => listRoomEvents(room.id, date))
       );
       const allBookings: BookingEvent[] = [];
       for (let i = 0; i < results.length; i++) {
         const result = results[i]!;
         if (result.status === 'fulfilled') {
           const room = ROOMS[i]!;
           for (const booking of result.value) {
             booking.roomName = room.name;
             allBookings.push(booking);
           }
         }
       }
       ```
     - 기존 `const myBookings = bookings.filter(...)` 유지하되 `bookings` → `allBookings`으로 변경
     - 정렬 추가: `myBookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());`
     - `buildBookingListModal(myBookings, roomId)` → `buildBookingListModal(myBookings)` 호출 변경

  **Must NOT do**:
  - calendar.ts 수정
  - conversation.ts 수정
  - Handler 3, 4 수정
  - buildEditBookingModal, buildCancelConfirmModal 수정

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 기존 코드 리팩토링, 여러 함수 수정, Promise.allSettled 패턴 적용
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (sequential)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/views/edit-modal.ts:35-98` — 현재 `buildDateRoomSelectModal()` — room_block 제거 대상
  - `src/views/edit-modal.ts:100-165` — 현재 `buildBookingListModal()` — 시그니처/옵션/metadata 변경 대상
  - `src/listeners/views/edit-submit.ts:12-69` — 현재 Handler 1 — 병렬 조회로 리팩토링 대상
  - `src/listeners/views/edit-submit.ts:108-109` — `getRoomById` roomName 채우기 패턴 참조

  **API/Type References**:
  - `src/types/index.ts:99-109` — `BookingEvent` 타입 (roomId, roomName 필드 확인)
  - `src/config/rooms.ts:83` — `ROOMS` 배열 export (전체 회의실 목록)
  - `src/config/rooms.ts:85-87` — `getRoomById()` 함수
  - `src/services/calendar.ts:216-246` — `listRoomEvents()` 함수 시그니처 (수정하지 말 것)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: buildDateRoomSelectModal이 날짜만 포함하는지 확인
    Tool: Bash (node)
    Steps:
      1. node -e "const m = require('./dist/views/edit-modal.js'); const v = m.buildDateRoomSelectModal(); console.log('blocks:', v.blocks.length); console.log('has_date:', v.blocks.some(b => b.block_id === 'date_block')); console.log('has_room:', v.blocks.some(b => b.block_id === 'room_block'));"
    Expected Result: blocks: 1, has_date: true, has_room: false
    Evidence: .sisyphus/evidence/task-1-modal1-no-room.txt

  Scenario: buildBookingListModal이 roomId 파라미터 없이 동작하는지 확인
    Tool: Bash (node)
    Steps:
      1. node -e "const m = require('./dist/views/edit-modal.js'); const bookings = [{eventId:'e1',summary:'테스트회의',startTime:new Date('2026-03-02T10:00:00'),endTime:new Date('2026-03-02T11:00:00'),organizer:'test@test.com',attendees:[],roomId:'room1@resource.calendar.google.com',roomName:'Meeting Room 1'}]; const v = m.buildBookingListModal(bookings); console.log('callback_id:', v.callback_id); const meta = JSON.parse(v.private_metadata); console.log('has_roomId_in_meta:', 'roomId' in meta); console.log('has_date_in_meta:', 'date' in meta); const opt = v.blocks[0].element.options[0]; console.log('value_has_separator:', opt.value.includes('::')); console.log('text_has_roomname:', opt.text.text.includes('Meeting Room 1'));"
    Expected Result: callback_id: edit_booking_select, has_roomId_in_meta: false, has_date_in_meta: true, value_has_separator: true, text_has_roomname: true
    Evidence: .sisyphus/evidence/task-1-bookinglist-format.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-modal1-no-room.txt
  - [ ] task-1-bookinglist-format.txt

  **Commit**: YES
  - Message: `refactor(edit): 날짜 기반 전체 회의실 조회로 변경 + 포커싱룸 포함`
  - Files: `src/views/edit-modal.ts`, `src/listeners/views/edit-submit.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [ ] 2. Handler 2 option value 파싱 변경

  **What to do**:

  **`src/listeners/views/edit-submit.ts` Handler 2 수정 (line 72-133):**

  1. `edit_booking_select` handler 내부:
     - metadata에서 roomId 추출 삭제: `const roomId = meta.roomId ?? '';` 제거
     - meta 타입 변경: `{ roomId?: string; date?: string }` → `{ date?: string }`
     - eventId 추출 코드 변경:
       ```typescript
       // 기존
       const eventId = values['booking_select_block']?.['booking_radio']?.selected_option?.value ?? '';
       
       // 변경
       const selectedValue = values['booking_select_block']?.['booking_radio']?.selected_option?.value ?? '';
       const [roomId, eventId] = selectedValue.split('::');
       ```
     - validation 조건 유지: `if (!roomId || !eventId || !dateStr)` 그대로
     - 나머지 로직 변경 없음 (listRoomEvents(roomId, date), getRoomById, booking 전달 등 동일)

  **Must NOT do**:
  - Handler 3, 4 수정
  - buildEditBookingModal, buildCancelConfirmModal 수정
  - callback_id 변경

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 handler 내 3줄 변경
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/listeners/views/edit-submit.ts:72-133` — 현재 Handler 2 코드
  - `src/listeners/views/edit-submit.ts:79-81` — 현재 metadata/roomId 추출 부분

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript 컴파일 성공
    Tool: Bash
    Steps:
      1. npx tsc --noEmit (in C:\Users\황병하\slack-room-bot)
    Expected Result: exit code 0, no output
    Evidence: .sisyphus/evidence/task-2-tsc.txt

  Scenario: 봇 기동 테스트
    Tool: Bash (timeout 10s)
    Steps:
      1. node -e "try { require('./dist/app.js'); console.log('MODULE LOADED OK'); } catch(e) { console.log('LOAD ERROR:', e.message); }" (timeout 15s)
    Expected Result: "MODULE LOADED OK" 출력 후 봇 시작 메시지
    Evidence: .sisyphus/evidence/task-2-startup.txt

  Scenario: Handler 2가 :: 파싱을 사용하는지 확인
    Tool: Grep
    Steps:
      1. grep "split('::')" src/listeners/views/edit-submit.ts
    Expected Result: 매칭 결과 1개 이상
    Evidence: .sisyphus/evidence/task-2-split-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-tsc.txt
  - [ ] task-2-startup.txt
  - [ ] task-2-split-check.txt

  **Commit**: YES (Task 1과 합쳐서)
  - Message: `refactor(edit): handler 2 roomId::eventId 파싱 적용`
  - Files: `src/listeners/views/edit-submit.ts`
  - Pre-commit: `npx tsc --noEmit`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `unspecified-high`
  Read the plan. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Verify edit-modal.ts has no room_block, handler 1 queries ROOMS array, handler 2 uses split('::').
  Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Scope Fidelity Check** — `unspecified-high`
  Verify ONLY edit-modal.ts and edit-submit.ts were modified. Verify calendar.ts, conversation.ts, buildEditBookingModal, buildCancelConfirmModal are UNMODIFIED. Verify no new files created. Verify no new dependencies.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Task 1+2**: `refactor(edit): 날짜 기반 전체 회의실 조회 + 포커싱룸 포함` — edit-modal.ts, edit-submit.ts | `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit              # Expected: exit 0
npm run build                  # Expected: exit 0
node -e "require('./dist/app.js')"  # Expected: no crash (timeout 15s)
```

### Final Checklist
- [ ] 첫 모달: 날짜만 선택 (회의실 선택 없음)
- [ ] 모든 회의실(10개) 병렬 조회
- [ ] 내 예약만 필터 (기존 동작 유지)
- [ ] 예약 목록에 회의실 이름 표시
- [ ] 시간순 정렬
- [ ] 수정/취소 모달 정상 작동
- [ ] Setup panel 버튼에서도 정상 작동
- [ ] calendar.ts 변경 없음
- [ ] conversation.ts 변경 없음
