# Bug #8 + Room Rename: Admin Impersonation Fix & Focus Room Naming

## TL;DR

> **Quick Summary**: (1) Service account cannot access room resource calendars without impersonation, causing 404 errors on edit/cancel flow. Fix by adding a `getRoomCalendarClient()` helper. (2) Rename all "Focusing Room" → "Focus Room" (English) and "포커싱룸" → "포커스룸" (Korean) across 8 files.
> 
> **Deliverables**:
> - `getRoomCalendarClient()` helper function in `calendar.ts`
> - 3 call sites updated to use the new helper
> - 6 room display names renamed: "Focusing Room X" → "Focus Room X" in `rooms.ts`
> - All "포커싱룸" Korean display text renamed to "포커스룸" across 7 files
> - Build passes, no 404 errors on room calendar access
> 
> **Estimated Effort**: Quick (< 30 min)
> **Parallel Execution**: YES — 2 tasks in Wave 1 (parallel, independent files)
> **Critical Path**: Task 1 + Task 2 (parallel) → Build verification → Git commit/push → Deploy verification

---

## Context

### Original Request
User deployed the 7-bug fix plan but the edit/cancel flow still shows "해당 날짜에 수정 가능한 예약이 없습니다". Render logs revealed 404 Not Found errors from Google Calendar API when the service account attempts to access room resource calendars.

### Root Cause Analysis
The service account (`getCalendarClient()`) lacks direct access to room resource calendars. Google Workspace shares free/busy info org-wide (so `freebusy.query` works), but `events.list`, `events.get`, `events.patch`, and `events.delete` on room calendars require explicit calendar access or domain-wide delegation with impersonation.

| Operation | Auth Method | Calendar Target | Result |
|-----------|------------|-----------------|--------|
| 예약 생성 (`createBooking`) | `getCalendarClientForUser(organizer)` — user impersonation | `primary` (user's calendar) | ✅ Works |
| 가용성 확인 (`getAvailableRooms`) | `getCalendarClient()` — service account | FreeBusy API | ✅ Works |
| 가용 종료시간 (`getRoomAvailableUntil`) | `getCalendarClient()` — service account | FreeBusy API | ✅ Works |
| **예약 목록** (`listRoomEvents`) | `getCalendarClient()` — service account | `roomId` calendar | ❌ **404** |
| **예약 수정** (`updateBooking`) | `getCalendarClient()` — service account | `roomId` calendar | ❌ **404** |
| **예약 취소** (`cancelBooking`) | `getCalendarClient()` — service account | `roomId` calendar | ❌ **404** |

### Previous Work
7 bugs fixed and deployed (plan: `.sisyphus/plans/edit-cancel-bugfix.md`). All code changes committed, pushed, and live on Render. Those fixes were correct but couldn't take effect because the underlying 404 prevented any bookings from being listed.

---

## Work Objectives

### Core Objective
Enable the service account to access room resource calendars by impersonating the admin user (`GOOGLE_ADMIN_EMAIL`) for room calendar CRUD operations.

### Concrete Deliverables
- New helper function `getRoomCalendarClient()` in `src/services/calendar.ts`
- 3 lines changed: `getCalendarClient()` → `getRoomCalendarClient()` in `listRoomEvents`, `updateBooking`, `cancelBooking`

### Definition of Done
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npm run build` succeeds
- [x] `getRoomCalendarClient` function exists in calendar.ts
- [x] `listRoomEvents`, `updateBooking`, `cancelBooking` all use `getRoomCalendarClient()`
- [x] `getAvailableRooms`, `getRoomAvailableUntil`, `createBooking` are NOT modified

### Must Have
- `getRoomCalendarClient()` checks `process.env['GOOGLE_ADMIN_EMAIL']` and uses `getCalendarClientForUser(adminEmail)` when available
- Fallback to `getCalendarClient()` when `GOOGLE_ADMIN_EMAIL` is not set (graceful degradation)
- Exactly 3 call sites changed in `calendar.ts`, no more
- All 6 "Focusing Room" display names changed to "Focus Room" in `rooms.ts`
- All "포커싱룸" user-visible strings changed to "포커스룸" across `book-modal.ts`, `book-type-select.ts`, `book-submit.ts`, `conversation.ts`, `message-parser.ts`
- All "포커싱룸" comments changed to "포커스룸" across `book-submit.ts`, `book-type-select.ts`, `message-parser.ts`, `conversation.ts`, `mention.ts`, `dm.ts`
- `message-parser.ts` regex updated to also match "포커스룸" and "포커스 룸" (backward-compatible, keeps old keywords)

### Must NOT Have (Guardrails)
- DO NOT modify `google-auth.ts` — helper goes in `calendar.ts`
- DO NOT modify `createBooking()` — it already works with `getCalendarClientForUser(organizer)`
- DO NOT modify `getAvailableRooms()` or `getRoomAvailableUntil()` — FreeBusy API works fine
- DO NOT change any function signatures (parameter types remain identical, only names change)
- DO NOT add new npm dependencies
- DO NOT modify `env.ts` or `notification.ts`
- DO NOT change callback_id values
- DO NOT modify `edit-modal.ts` value format (`roomId::eventId`)
- DO NOT change room `id` fields in `rooms.ts` (`focusing-room-X@resource.calendar.google.com`) — these are Google Calendar resource IDs, changing them will cause 404 errors on ALL operations
- DO rename room `type: 'focusing'` → `'focus'` in rooms.ts AND update `RoomType` in types/index.ts
- DO rename all internal code identifiers containing 'Focusing/focusing' to 'Focus/focus' for consistency
- DO change `value: 'focusing'` to `value: 'focus'` in `book-modal.ts` and `book-type-select.ts`

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (project has build tooling)
- **Automated tests**: NO (no test framework configured, not adding one for this hotfix)
- **Framework**: None

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Build**: Use Bash — `npx tsc --noEmit`, `npm run build`
- **Code verification**: Use Grep/Read — confirm exact code patterns

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (2 tasks in parallel — independent files):
├── Task 1: Add getRoomCalendarClient() + update 3 call sites in calendar.ts [quick]
└── Task 2: Complete 'focusing' → 'focus' rename across 10 files [unspecified-high]
    (display text + type enum + variable/function names + comments)

Wave FINAL (After Wave 1 — verification):
├── Task F1: Build verification [quick]
├── Task F2: Code pattern verification [quick]
└── Task F3: Negative verification — unchanged items [quick]

Critical Path: Task 1 + Task 2 (parallel) → F1/F2/F3
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | None | F1, F2, F3 |
| 2 | None | F1, F2, F3 |
| F1 | 1, 2 | — |
| F2 | 1, 2 | — |
| F3 | 1, 2 | — |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T2 → `unspecified-high` (parallel)
- **Wave FINAL**: 3 tasks — F1/F2/F3 → `quick` (parallel)

---

## TODOs

- [x] 1. Add `getRoomCalendarClient()` helper and update 3 call sites in `calendar.ts`

  **What to do**:
  1. Add a new helper function `getRoomCalendarClient()` in `src/services/calendar.ts`, placed BEFORE the `listRoomEvents` function (between `getKSTDayRange` helper ending at line 225 and `listRoomEvents` starting at line 227). The function body:
     ```typescript
     function getRoomCalendarClient() {
       const adminEmail = process.env['GOOGLE_ADMIN_EMAIL'];
       if (adminEmail) {
         return getCalendarClientForUser(adminEmail);
       }
       return getCalendarClient();
     }
     ```
  2. In `listRoomEvents` (current line 228): Change `const calendar = getCalendarClient();` → `const calendar = getRoomCalendarClient();`
  3. In `updateBooking` (current line 265): Change `const calendar = getCalendarClient();` → `const calendar = getRoomCalendarClient();`
  4. In `cancelBooking` (current line 307): Change `const calendar = getCalendarClient();` → `const calendar = getRoomCalendarClient();`

  **Must NOT do**:
  - Do NOT modify `getAvailableRooms()` (line 20, uses FreeBusy — works fine)
  - Do NOT modify `getRoomAvailableUntil()` (line 177, uses FreeBusy — works fine)
  - Do NOT modify `createBooking()` (uses `getCalendarClientForUser(organizer)` — works fine)
  - Do NOT export `getRoomCalendarClient` — it is a private module helper
  - Do NOT add any new imports — `getCalendarClient` and `getCalendarClientForUser` are already imported on line 1
  - Do NOT change any function signatures

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, 7 lines total change, no ambiguity — trivial mechanical edit
  - **Skills**: []
    - No skills needed — pure code editing task
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed
    - `git-master`: Git operations handled separately by user

  **Parallelization**:
  - **Can Run In Parallel**: NO (only 1 task)
  - **Parallel Group**: Wave 1 (sole task)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References** (CRITICAL):

  **Pattern References** (existing code to follow):
  - `src/services/calendar.ts:1` — Import line showing `getCalendarClientForUser` is already imported
  - `src/services/calendar.ts:82-110` — `createBooking()` function shows the pattern of using `getCalendarClientForUser(email)` with a specific user email. The new helper follows the same pattern but with admin email.
  - `src/services/google-auth.ts:55-65` — `getCalendarClientForUser(userEmail)` implementation showing how impersonation works (creates JWT client with `subject: userEmail`). This is what the new helper will call.

  **API/Type References**:
  - `src/services/google-auth.ts:60` — Shows `GOOGLE_ADMIN_EMAIL` env var already used for Directory API impersonation. Same env var reused here.
  - `src/services/calendar.ts:228` — Current `getCalendarClient()` call in `listRoomEvents` — THE LINE TO CHANGE
  - `src/services/calendar.ts:265` — Current `getCalendarClient()` call in `updateBooking` — THE LINE TO CHANGE
  - `src/services/calendar.ts:307` — Current `getCalendarClient()` call in `cancelBooking` — THE LINE TO CHANGE

  **WHY Each Reference Matters**:
  - Line 1 import: Confirms no new import needed — `getCalendarClientForUser` already available
  - `createBooking` pattern: Shows the proven pattern of impersonation that we're replicating
  - `google-auth.ts:60`: Confirms `GOOGLE_ADMIN_EMAIL` is an established env var in this project
  - Lines 228/265/307: Exact locations of the 3 lines that need changing

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY**

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Build succeeds after changes
    Tool: Bash
    Preconditions: All changes applied to calendar.ts
    Steps:
      1. Run `npx tsc --noEmit` in project root (C:\Users\황병하\slack-room-bot)
      2. Run `npm run build` in project root
    Expected Result: Both commands exit with code 0, no TypeScript errors
    Failure Indicators: Any TypeScript compilation error, non-zero exit code
    Evidence: .sisyphus/evidence/task-1-build-check.txt

  Scenario: getRoomCalendarClient function exists with correct body
    Tool: Grep + Read
    Preconditions: Changes applied
    Steps:
      1. Grep for "function getRoomCalendarClient" in calendar.ts
      2. Read the function body — verify it checks process.env['GOOGLE_ADMIN_EMAIL']
      3. Verify it calls getCalendarClientForUser(adminEmail) when env var exists
      4. Verify it falls back to getCalendarClient() when env var is absent
    Expected Result: Function exists with correct conditional logic
    Failure Indicators: Function not found, wrong env var name, missing fallback
    Evidence: .sisyphus/evidence/task-1-helper-exists.txt

  Scenario: Exactly 3 call sites updated
    Tool: Grep
    Preconditions: Changes applied
    Steps:
      1. Grep for "getRoomCalendarClient()" in calendar.ts — expect exactly 3 matches (in listRoomEvents, updateBooking, cancelBooking)
      2. Grep for "getCalendarClient()" in calendar.ts — expect exactly 2 matches (in getAvailableRooms line 20 and getRoomAvailableUntil line 177) plus 1 in the fallback inside getRoomCalendarClient
    Expected Result: 3 call sites use getRoomCalendarClient(), remaining 2 still use getCalendarClient() directly
    Failure Indicators: Wrong count — either too many or too few replacements
    Evidence: .sisyphus/evidence/task-1-call-sites.txt

  Scenario: Unchanged functions NOT modified (negative check)
    Tool: Grep + Read
    Preconditions: Changes applied
    Steps:
      1. Read getAvailableRooms function — verify line 20 still has `getCalendarClient()` (NOT getRoomCalendarClient)
      2. Read getRoomAvailableUntil function — verify line 177 still has `getCalendarClient()` (NOT getRoomCalendarClient)
      3. Read createBooking function — verify it still uses `getCalendarClientForUser(organizer)` (NOT getRoomCalendarClient)
    Expected Result: All 3 functions untouched — using their original auth methods
    Failure Indicators: Any of these 3 functions modified
    Evidence: .sisyphus/evidence/task-1-unchanged-functions.txt
  ```

  **Evidence to Capture:**
  - [x] task-1-build-check.txt — tsc + build output
  - [x] task-1-helper-exists.txt — grep output showing function
  - [x] task-1-call-sites.txt — grep counts for both function names
  - [x] task-1-unchanged-functions.txt — read output of 3 unchanged functions

  **Commit**: YES
  - Message: `fix(calendar): use admin impersonation for room calendar access`
  - Files: `src/services/calendar.ts`
  - Pre-commit: `npx tsc --noEmit`

- [x] 2. Complete 'focusing' → 'focus' rename: display text + type enum + variable names + comments (10 files)

  **What to do**:

  **A. Type definition in `src/types/index.ts` (3 changes):**
  - Line 6: comment `// 방 타입 (meeting 또는 focusing)` → `// 방 타입 (meeting 또는 focus)`
  - Line 69: `export type RoomType = 'meeting' | 'focusing';` → `export type RoomType = 'meeting' | 'focus';`
  - Line 80: `| 'waiting_focusing_select';` → `| 'waiting_focus_select';`

  **B. Room config in `src/config/rooms.ts` (12 changes):**
  - Lines 30,36,42,48,54,60: 6x `name: 'Focusing Room X'` → `name: 'Focus Room X'`
  - Lines 32,38,44,50,56,62: 6x `type: 'focusing'` → `type: 'focus'`
  - DO NOT change `id` fields (`focusing-room-X@resource.calendar.google.com`) — these are Google Calendar resource IDs

  **C. Modal view in `src/views/book-modal.ts` (1 change):**
  - Line 36: `text: '🎯 포커싱룸 (1인용)', ... value: 'focusing'` → `text: '🎯 포커스룸 (1인용)', ... value: 'focus'`

  **D. Book type select in `src/listeners/actions/book-type-select.ts` (8 changes):**
  - Line 23: `selectedType === 'focusing'` → `=== 'focus'`
  - Line 24: comment `// 포커싱룸 모달` → `// 포커스룸 모달`
  - Line 25: `const focusingModal` → `const focusModal`
  - Line 28: `roomType: 'focusing'` → `roomType: 'focus'`
  - Line 29: `text: '포커싱룸 예약'` → `text: '포커스룸 예약'`
  - Line 40: `text: '🎯 포커싱룸 (1인용)', ... value: 'focusing'` → `text: '🎯 포커스룸 (1인용)', ... value: 'focus'`
  - Line 43: same as line 40
  - Line 91: `focusingModal` → `focusModal`

  **E. Book submit in `src/listeners/views/book-submit.ts` (8 changes):**
  - Line 28: `'meeting' | 'focusing'` → `'meeting' | 'focus'`
  - Line 32: `=== 'focusing') ? 'focusing' : 'meeting'` → `=== 'focus') ? 'focus' : 'meeting'`
  - Line 70: comment `// 포커싱룸 분기` → `// 포커스룸 분기`
  - Line 71: `roomType === 'focusing'` → `=== 'focus'`
  - Line 72: `getRoomsByType('focusing')` → `getRoomsByType('focus')`
  - Line 73: `focusingRooms.length` → `focusRooms.length`
  - Line 76: `'😔 포커싱룸이 설정되어 있지 않습니다.'` → `'😔 포커스룸이 설정되어 있지 않습니다.'`
  - Lines 72,73,90,98: rename `focusingRooms` → `focusRooms` (local variable, 4 occurrences)

  **F. Book room function in `src/listeners/functions/book-room.ts` (2 changes):**
  - Line 17: `=== 'focusing' ? 'focusing' : 'meeting'` → `=== 'focus' ? 'focus' : 'meeting'`
  - Line 28: `as 'meeting' | 'focusing'` → `as 'meeting' | 'focus'`

  **G. Conversation service in `src/services/conversation.ts` (14 changes):**
  - Line 106: `buildFocusingRoomList` → `buildFocusRoomList` (exported function name)
  - Line 108: `'사용 가능한 포커싱룸 목록입니다:'` → `'사용 가능한 포커스룸 목록입니다:'`
  - Line 111: `buildFocusingCapacityWarning` → `buildFocusCapacityWarning` (exported function name)
  - Line 112: `'포커싱룸은 1인용 공간입니다.'` → `'포커스룸은 1인용 공간입니다.'`
  - Line 266: `'waiting_focusing_select'` → `'waiting_focus_select'`
  - Line 269: comment `// 포커싱룸 목록 조회` → `// 포커스룸 목록 조회`
  - Line 270: `availableFocusing` → `availableFocus` (local, also used on line 271)
  - Line 271: `availableFocusingFiltered` → `availableFocusFiltered` (local, also lines 273, 278, 279)
  - Line 271: `.type === 'focusing'` → `.type === 'focus'`
  - Line 275: `'😔 해당 시간대에 사용 가능한 포커싱룸이 없습니다.'` → `'😔 해당 시간대에 사용 가능한 포커스룸이 없습니다.'`
  - Line 282: `selectedFocusingRoom` → `selectedFocusRoom` (local, also line 285)
  - Line 376: comment `// 포커싱룸 대화 시작 헬퍼` → `// 포커스룸 대화 시작 헬퍼`
  - Line 377: `startFocusingConversation` → `startFocusConversation` (exported function name)
  - Line 384: `.type === 'focusing'` → `.type === 'focus'`
  - Lines 384,386,390,393: `focusingRooms` → `focusRooms` (local variable)
  - Line 387: `'😔 해당 시간대에 사용 가능한 포커싱룸이 없습니다.'` → `'😔 해당 시간대에 사용 가능한 포커스룸이 없습니다.'`
  - Line 390: `'focusing',` → `'focus',`
  - Line 391: `'waiting_focusing_select'` → `'waiting_focus_select'`
  - Line 393: `buildFocusingRoomList` → `buildFocusRoomList`

  **H. Message parser in `src/services/message-parser.ts` (3 changes):**
  - Line 270: comment `// 포커싱룸 키워드 감지` → `// 포커스룸 키워드 감지`
  - Line 271: rename `isFocusingRoom` → `isFocusRoom` (local variable, also line 280)
  - Line 271: regex `/포커싱룸|포커싱 룸|집중실|집중 공간/` → `/포커스룸|포커스 룸|포커싱룸|포커싱 룸|집중실|집중 공간/` (keep old keywords for backward compat)
  - Line 280: `isFocusingRoom ? 'focusing'` → `isFocusRoom ? 'focus'`

  **I. Mention event in `src/listeners/events/mention.ts` (3 changes):**
  - Line 16: `import { startFocusingConversation }` → `import { startFocusConversation }`
  - Line 77: comment `// 포커싱룸 요청` → `// 포커스룸 요청`
  - Line 78: `intent.roomType === 'focusing'` → `=== 'focus'`
  - Line 79: `startFocusingConversation` → `startFocusConversation`

  **J. DM event in `src/listeners/events/dm.ts` (3 changes):**
  - Line 7: `import { startFocusingConversation }` → `import { startFocusConversation }`
  - Line 70: comment `// 포커싱룸 요청` → `// 포커스룸 요청`
  - Line 71: `intent.roomType === 'focusing'` → `=== 'focus'`
  - Line 72: `startFocusingConversation` → `startFocusConversation`

  **Must NOT do**:
  - Do NOT change `id` fields (`focusing-room-X@resource.calendar.google.com`) — Google Calendar resource IDs, changing breaks ALL booking
  - Do NOT change the `value: 'focusing'` that was ALREADY changed to `value: 'focus'` in the same line (it's one edit per line)
  - Do NOT rename files themselves
  - Do NOT change meeting room configuration
  - Do NOT modify `calendar.ts` (Task 1's scope)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 10 files, ~60 changes, type refactoring with cross-file dependencies. Needs careful attention.
  - **Skills**: []
    - No skills needed — text editing with attention to detail

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1 — no overlapping files)
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: None

  **References** (CRITICAL):

  **Files to modify (complete list — 10 files):**
  1. `src/types/index.ts` — RoomType definition + ConversationStage (3 changes)
  2. `src/config/rooms.ts` — name + type fields (12 changes)
  3. `src/views/book-modal.ts` — dropdown text + value (1 change)
  4. `src/listeners/actions/book-type-select.ts` — modal + comparisons (8 changes)
  5. `src/listeners/views/book-submit.ts` — type declarations + comparisons (8 changes)
  6. `src/listeners/functions/book-room.ts` — type cast + comparison (2 changes)
  7. `src/services/conversation.ts` — function names + strings + comparisons (14 changes)
  8. `src/services/message-parser.ts` — regex + variable + return value (3 changes)
  9. `src/listeners/events/mention.ts` — import + comparison (3 changes)
  10. `src/listeners/events/dm.ts` — import + comparison (3 changes)

  **CRITICAL ORDER**: Modify `types/index.ts` FIRST (changes the type definition), then all other files.
  TypeScript will error until ALL files are updated. The agent must update ALL files before running `tsc`.

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY**

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Build succeeds after all renames
    Tool: Bash
    Preconditions: ALL 10 files updated
    Steps:
      1. Run `npx tsc --noEmit` in project root (C:\Users\황병하\slack-room-bot)
    Expected Result: Exit code 0, zero errors
    Failure Indicators: Any TypeScript error (likely means a 'focusing' literal was missed)
    Evidence: .sisyphus/evidence/task-2-build-check.txt

  Scenario: Zero 'focusing' string literals remain (except Google Calendar IDs)
    Tool: Grep
    Preconditions: ALL files updated
    Steps:
      1. Grep for `'focusing'` (with quotes) across ALL src/ files
      2. Verify the ONLY remaining matches are `id: 'focusing-room-X@...'` in rooms.ts (6 matches)
      3. NO other file should contain `'focusing'` as a string literal
    Expected Result: Exactly 6 matches, all in rooms.ts id fields
    Failure Indicators: Any `'focusing'` in non-id context
    Evidence: .sisyphus/evidence/task-2-no-focusing-literals.txt

  Scenario: All English room names changed to "Focus Room"
    Tool: Grep
    Preconditions: Changes applied to rooms.ts
    Steps:
      1. Grep for "Focusing Room" in rooms.ts — expect 0 matches
      2. Grep for "Focus Room" in rooms.ts — expect exactly 6 matches
    Expected Result: Zero "Focusing Room", six "Focus Room"
    Evidence: .sisyphus/evidence/task-2-room-names.txt

  Scenario: Korean display text all changed to "포커스룸"
    Tool: Grep
    Preconditions: ALL files updated
    Steps:
      1. Grep for "포커싱룸" across src/ — should ONLY appear in message-parser.ts regex (backward compat)
      2. Grep for "포커스룸" across src/ — should appear in 7 files
    Expected Result: Only regex backward-compat matches for "포커싱룸"; all display text shows "포커스룸"
    Evidence: .sisyphus/evidence/task-2-korean-strings.txt

  Scenario: RoomType definition correctly updated
    Tool: Read
    Preconditions: types/index.ts updated
    Steps:
      1. Read line 69 of types/index.ts
      2. Verify it reads: `export type RoomType = 'meeting' | 'focus';`
      3. Read line 80 — verify `'waiting_focus_select'`
    Expected Result: Both type values updated
    Evidence: .sisyphus/evidence/task-2-type-definition.txt

  Scenario: Room IDs unchanged (CRITICAL negative check)
    Tool: Grep
    Preconditions: Changes applied
    Steps:
      1. Grep for "focusing-room-" in rooms.ts — expect exactly 6 matches (id fields preserved)
      2. Grep for "focus-room-" in rooms.ts — expect 0 matches (IDs must NOT be renamed)
    Expected Result: All 6 Google Calendar resource IDs unchanged
    Failure Indicators: Any id field changed from focusing-room- to focus-room-
    Evidence: .sisyphus/evidence/task-2-ids-unchanged.txt

  Scenario: Exported function names correctly renamed
    Tool: Grep
    Preconditions: conversation.ts, mention.ts, dm.ts updated
    Steps:
      1. Grep for "startFocusingConversation" across src/ — expect 0 matches
      2. Grep for "startFocusConversation" across src/ — expect matches in conversation.ts, mention.ts, dm.ts
      3. Grep for "buildFocusingRoomList" across src/ — expect 0 matches
      4. Grep for "buildFocusRoomList" across src/ — expect matches in conversation.ts
    Expected Result: All exported functions renamed, all import sites updated
    Evidence: .sisyphus/evidence/task-2-function-renames.txt
  ```

  **Evidence to Capture:**
  - [x] task-2-build-check.txt — tsc output
  - [x] task-2-no-focusing-literals.txt — grep confirming no stale 'focusing' literals
  - [x] task-2-room-names.txt — grep confirming English name changes
  - [x] task-2-korean-strings.txt — grep confirming Korean string changes
  - [x] task-2-type-definition.txt — read output of types/index.ts
  - [x] task-2-ids-unchanged.txt — grep confirming Google Calendar IDs preserved
  - [x] task-2-function-renames.txt — grep confirming function renames

  **Commit**: YES (grouped with Task 1)
  - Message: `refactor: rename focusing to focus + admin impersonation for room calendar`
  - Files: all 10 files listed above + `src/services/calendar.ts`
  - Pre-commit: `npx tsc --noEmit`
---

## Final Verification Wave (MANDATORY — after ALL Wave 1 tasks)

> All 3 checks run in PARALLEL after Task 1 AND Task 2 complete.

- [x] F1. **Build Verification** — `quick`
  Run `npx tsc --noEmit` and `npm run build`. Both must pass with zero errors.
  Output: `Build [PASS/FAIL] | TSC [PASS/FAIL] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Pattern Verification** — `quick`
  Grep calendar.ts for `getRoomCalendarClient()` — must find exactly 3 usages.
  Grep calendar.ts for `function getRoomCalendarClient` — must find exactly 1 definition.
  Read the function body — must check `GOOGLE_ADMIN_EMAIL` and call `getCalendarClientForUser`.
  Grep rooms.ts for `Focus Room` — must find exactly 6 matches.
  Grep rooms.ts for `Focusing Room` — must find 0 matches.
  Grep ALL src/ for `'focusing'` (with quotes) — should ONLY appear in rooms.ts `id` fields (6 matches).
  Grep ALL src/ for `'focus'` — must appear in rooms.ts type fields + all comparison sites.
  Grep ALL src/ for "포커싱룸" — should only appear in message-parser.ts regex (backward compat).
  Grep ALL src/ for "포커스룸" — must appear in display text files.
  Grep for `startFocusingConversation` — must find 0 matches (all renamed to `startFocusConversation`).
  Output: `Helper [EXISTS/MISSING] | Call Sites [N/3] | EN Names [N/6] | Type Enum [PASS/FAIL] | KR Strings [PASS/FAIL] | VERDICT`

- [x] F3. **Negative Verification** — `quick`
  Verify `getAvailableRooms` still uses `getCalendarClient()` (NOT `getRoomCalendarClient`).
  Verify `getRoomAvailableUntil` still uses `getCalendarClient()` (NOT `getRoomCalendarClient`).
  Verify `createBooking` still uses `getCalendarClientForUser(organizer)`.
  Verify `getRoomCalendarClient` is NOT exported.
  Verify room `id` fields still contain `focusing-room-` (NOT changed to `focus-room-`).
  Verify room `type` fields now contain `'focus'` (NOT still `'focusing'`).
  Verify `RoomType` in types/index.ts is `'meeting' | 'focus'`.
  Output: `Unchanged Functions [3/3] | Not Exported [YES/NO] | Room IDs [6/6 preserved] | Type Enum [updated] | VERDICT`

---

## Commit Strategy

- **Task 1 + Task 2 (single commit)**: `refactor: rename focusing to focus + admin impersonation for room calendar`
  - Files: `src/services/calendar.ts`, `src/types/index.ts`, `src/config/rooms.ts`, `src/views/book-modal.ts`, `src/listeners/actions/book-type-select.ts`, `src/listeners/views/book-submit.ts`, `src/listeners/functions/book-room.ts`, `src/services/conversation.ts`, `src/services/message-parser.ts`, `src/listeners/events/mention.ts`, `src/listeners/events/dm.ts`
  - Pre-commit: `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit          # Expected: exit 0, no errors
npm run build             # Expected: exit 0, build succeeds
```

### Final Checklist
- [x] `getRoomCalendarClient()` helper function exists in calendar.ts
- [x] Helper checks `GOOGLE_ADMIN_EMAIL` env var and impersonates admin
- [x] Helper falls back to `getCalendarClient()` when env var absent
- [x] `listRoomEvents` uses `getRoomCalendarClient()` (was line 228)
- [x] `updateBooking` uses `getRoomCalendarClient()` (was line 265)
- [x] `cancelBooking` uses `getRoomCalendarClient()` (was line 307)
- [x] `getAvailableRooms` unchanged — still uses `getCalendarClient()` directly
- [x] `getRoomAvailableUntil` unchanged — still uses `getCalendarClient()` directly
- [x] `createBooking` unchanged — still uses `getCalendarClientForUser(organizer)`
- [x] TypeScript build passes with zero errors
- [x] No new imports added
- [x] No function signatures changed
- [x] Modified files: `calendar.ts`, `types/index.ts`, `rooms.ts`, `book-modal.ts`, `book-type-select.ts`, `book-submit.ts`, `book-room.ts`, `conversation.ts`, `message-parser.ts`, `mention.ts`, `dm.ts` (11 files total)
- [x] `RoomType` = `'meeting' | 'focus'` (was `'focusing'`)
- [x] `ConversationStage` includes `'waiting_focus_select'` (was `'waiting_focusing_select'`)
- [x] All 6 room `name` fields changed to "Focus Room X"
- [x] All 6 room `type` fields changed to `'focus'` (was `'focusing'`)
- [x] All 6 room `id` fields UNCHANGED (`focusing-room-X@...`)
- [x] Zero `'focusing'` string literals remain except in room `id` fields
- [x] All user-visible "포커싱룸" strings changed to "포커스룸"
- [x] message-parser.ts regex includes both old and new Korean keywords for backward compat
- [x] All exported function names renamed: `startFocusConversation`, `buildFocusRoomList`, `buildFocusCapacityWarning`
- [x] All import sites updated in mention.ts and dm.ts

### Post-Deploy Verification (Manual — by user)
After `git push` and Render deploy:
1. Open Slack bot → 예약 수정 → select a date → should show bookings (NOT "해당 날짜에 수정 가능한 예약이 없습니다")
2. Render logs should show NO 404 errors from Calendar API
3. Room names should display as "Focus Room X" and "포커스룸" in all Slack modals
