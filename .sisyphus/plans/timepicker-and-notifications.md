# Timepicker 마이그레이션 + 회의 알림 스케줄러

## TL;DR

> **Quick Summary**: 시간 선택 UI를 30분 단위 드롭다운에서 Slack 네이티브 timepicker로 교체하고, 회의 시작/종료 전 자동 알림 시스템을 새로 구축한다.
> 
> **Deliverables**:
> - 모든 예약 모달의 시간 선택이 timepicker로 변경 (분 단위 자유 선택)
> - 회의 시작 10분/5분 전, 종료 10분/5분 전 Slack DM 알림
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7 → Task 8

---

## Context

### Original Request
사용자 건의사항 2건:
1. "회의실을 예약할 수 있는 시간의 자율도를 높여달라" — 현재 30분 단위 → 분 단위 자유 선택
2. "회의 종료와 회의 시작 10분 전, 5분 전에 회의 참석자들에게 알림" — 총 4회 알림

### Interview Summary
**Key Discussions**:
- timepicker 네이티브 요소 사용 확정 (드롭다운 대신 시계 UI)
- 알림 타이밍 확정: 시작 전 10분/5분 + 종료 전 10분/5분 (총 4회)
- 알림은 Slack DM으로 참석자에게 전송

**Research Findings**:
- Slack timepicker: `type: "timepicker"`, `initial_time: "HH:mm"`, submission에서 `selected_time` (string)
- timepicker에는 time_min/time_max 없음 → 서버 사이드 검증 필요
- 현재 `generateTimeOptions()` 3곳에 복제 (common.ts, edit-modal.ts, book-type-select.ts)
- `listRoomEvents()` → `BookingEvent[]` (attendees 포함) 재사용 가능
- `sendDmToAttendees()` 패턴 재사용 가능
- Render 배포 → 서버 재시작 시 인메모리 상태 손실

### Metis Review
**Identified Gaps** (addressed):
- `book-type-select.ts`에 인라인 시간 선택 코드 있음 (놓치기 쉬움) → Task 2에 포함
- `guest-select.ts`, `recurring.ts`의 모달 리빌드 시 시간 보존 로직 업데이트 필요 → Task 4에 포함
- 짧은 회의(<10분) 시 종료 알림이 시작 전에 발생 → 가드 조건 추가
- `Promise.allSettled()` 사용으로 한 방 쿼리 실패가 전체를 막지 않도록 → Task 6에 반영

---

## Work Objectives

### Core Objective
시간 선택 자율도 향상 (timepicker) + 회의 전후 자동 알림 시스템 구축

### Concrete Deliverables
- `book-modal.ts`, `recurring-modal.ts`, `edit-modal.ts`, `book-type-select.ts` — timepicker UI
- `book-submit.ts`, `recurring-submit.ts`, `edit-submit.ts` — `selected_time` 파싱
- `guest-select.ts`, `recurring.ts` — 시간 값 보존
- `src/services/notification-scheduler.ts` — 새 파일 (스케줄러)
- `app.ts` — 스케줄러 등록

### Definition of Done
- [ ] 모든 모달에서 분 단위 시간 선택 가능
- [ ] 30분 단위가 아닌 시간 (예: 09:15) 으로 예약 성공
- [ ] 회의 시작/종료 10분/5분 전 DM 알림 수신
- [ ] `npx tsc --noEmit` 통과

### Must Have
- timepicker에서 선택한 시간이 Google Calendar 이벤트에 정확히 반영
- 게스트 토글/모달 리빌드 시 선택한 시간 보존
- 중복 알림 방지 (같은 이벤트에 같은 타입 알림 1회만)
- 한 방 쿼리 실패가 다른 방에 영향 안 줌

### Must NOT Have (Guardrails)
- 알림 시간 설정 UI 추가 금지 — 10분/5분 하드코딩
- 사용자별 알림 옵트아웃 기능 금지
- 외부 DB/Redis 등 영속 저장소 추가 금지 — 인메모리만
- timepicker에 timezone 속성 설정 금지 — KST 암묵적 유지
- now-book (즉시예약) 흐름 변경 금지 — duration 셀렉터 사용중이므로 무관
- 서버 재시작 후 과거 놓친 알림 소급 발송 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (테스트 프레임워크 없음)
- **Automated tests**: None
- **QA Policy**: Agent-Executed QA Scenarios per task

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — timepicker UI + scheduler skeleton):
├── Task 1: common.ts 정리 (generateTimeOptions 제거/deprecate) [quick]
├── Task 2: 모든 모달 timepicker 마이그레이션 (4개 파일) [unspecified-high]
├── Task 3: 모든 submission handler selected_time 파싱 (3개 파일) [quick]
├── Task 4: 모달 리빌드 시 시간 보존 업데이트 (2개 파일) [quick]
└── Task 5: notification-scheduler.ts 생성 [unspecified-high]

Wave 2 (After Wave 1 — integration):
├── Task 6: app.ts에 스케줄러 등록 [quick]
└── Task 7: 빌드 검증 + 커밋 + 푸시 [quick]

Wave FINAL (After ALL tasks):
└── Task 8: 전체 검증 [unspecified-high]

Critical Path: Task 2 → Task 3 → Task 7 → Task 8
Parallel Speedup: Task 1-5 모두 동시 실행 가능
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 2 |
| 2 | 1 | 3, 4 |
| 3 | 2 | 7 |
| 4 | 2 | 7 |
| 5 | — | 6 |
| 6 | 5 | 7 |
| 7 | 3, 4, 6 | 8 |
| 8 | 7 | — |

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — T1 → `quick`, T2 → `unspecified-high`, T3 → `quick`, T4 → `quick`, T5 → `unspecified-high`
- **Wave 2**: 2 tasks — T6 → `quick`, T7 → `quick`
- **FINAL**: 1 task — T8 → `unspecified-high`

---

## TODOs

- [ ] 1. common.ts 정리 — generateTimeOptions 제거

  **What to do**:
  - `src/views/common.ts`에서 `generateTimeOptions()` 함수 제거
  - `TimeOption` 인터페이스 제거 (더 이상 사용하지 않음)
  - `edit-modal.ts`의 `generateEditTimeOptions()` 제거
  - `book-type-select.ts`의 `generateTimeOptionsInline()` (있다면) 제거
  - `generateTimeOptions` import문이 있는 파일에서 제거

  **Must NOT do**:
  - `parseDateTimeString()`, `formatDateTime()`, `formatTimeRange()` 등 다른 유틸 함수 건드리지 않기
  - `toKST()` 함수 건드리지 않기

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/views/common.ts:19-33` — `generateTimeOptions()` 함수 정의 (제거 대상)
  - `src/views/common.ts:5-8` — `TimeOption` 인터페이스 (제거 대상)

  **API/Type References**:
  - `src/views/book-modal.ts:19` — `generateTimeOptions` import (제거할 것)
  - `src/views/recurring-modal.ts:19` — `generateTimeOptions` import (제거할 것)

  **Why Each Reference Matters**:
  - timepicker로 교체하면 이 함수들은 dead code가 됨. 깨끗하게 제거해야 빌드 경고 방지.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: generateTimeOptions가 완전히 제거되었는지 확인
    Tool: Bash (grep)
    Steps:
      1. grep -r "generateTimeOptions" src/ 실행
      2. grep -r "generateEditTimeOptions" src/ 실행
      3. grep -r "TimeOption" src/ 실행
    Expected Result: 모든 grep 결과 0건
    Evidence: .sisyphus/evidence/task-1-no-dead-code.txt

  Scenario: 빌드 성공 확인
    Tool: Bash
    Steps:
      1. npx tsc --noEmit 실행
    Expected Result: 에러 0건
    Evidence: .sisyphus/evidence/task-1-build.txt
  ```

  **Commit**: YES (groups with Task 2, 3, 4)
  - Message: `feat: timepicker 마이그레이션 — 30분 단위 드롭다운을 네이티브 timepicker로 교체`
  - Files: `src/views/common.ts`, `src/views/book-modal.ts`, `src/views/edit-modal.ts`, `src/views/recurring-modal.ts`, 기타
  - Pre-commit: `npx tsc --noEmit`

---

- [ ] 2. 모든 모달 timepicker 마이그레이션 (4개 파일)

  **What to do**:
  - **`src/views/book-modal.ts`** (lines 71-88):
    - start_time_input: `static_select` → `timepicker`, `options` 제거, `initial_time` 추가
    - end_time_input: 동일하게 변경
    - `BookModalOptions` 인터페이스의 `initialValues.startTime/endTime` 타입: `{ text: ...; value: string }` → `string`
  - **`src/views/recurring-modal.ts`** (lines 71-90):
    - start_time_input, end_time_input: 동일하게 `timepicker` 교체
    - `RecurringModalOptions` 인터페이스의 `initialValues.startTime/endTime` 타입 변경
  - **`src/views/edit-modal.ts`** (lines 248-268):
    - start_time_input, end_time_input: `timepicker` 교체
    - `generateEditTimeOptions()` 제거
    - `initial_time`에 기존 예약의 시간을 HH:mm 형식으로 설정
  - **`src/listeners/actions/book-type-select.ts`** (lines 72-87):
    - 인라인 `static_select` 시간 요소 → `timepicker` 교체

  **timepicker 블록 형식**:
  ```typescript
  {
    type: 'input',
    block_id: 'start_time_block',
    label: { type: 'plain_text', text: '🕐 시작 시간', emoji: true },
    element: {
      type: 'timepicker',
      action_id: 'start_time_input',
      initial_time: initialValues?.startTime ?? '09:00',
      placeholder: { type: 'plain_text', text: '시작 시간 선택' },
    },
  }
  ```

  **Must NOT do**:
  - `now-book` 관련 파일 변경 금지 (duration 셀렉터 사용)
  - `datepicker` 블록 변경 금지
  - action_id 변경 금지 — 기존 `start_time_input`, `end_time_input` 유지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 1 완료 후)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/views/book-modal.ts:67-89` — 현재 start/end time static_select 블록 구조
  - `src/views/recurring-modal.ts:69-90` — 현재 recurring 시간 선택 구조
  - `src/views/edit-modal.ts:241-270` — 현재 edit 시간 선택 구조 + generateEditTimeOptions
  - `src/listeners/actions/book-type-select.ts:72-87` — 인라인 포커스룸 시간 요소 (놓치기 쉬움!)

  **API/Type References**:
  - Slack timepicker element: `type: "timepicker"`, `initial_time: "HH:mm"`, `action_id: string`
  - `@slack/types`의 `Timepicker` 인터페이스 사용 가능
  - submission payload: `state.values[block_id][action_id].selected_time` (string | null)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: /예약 모달에서 timepicker 렌더링 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "type.*timepicker" src/views/book-modal.ts
      2. grep -n "type.*static_select" src/views/book-modal.ts
    Expected Result: timepicker 2건, static_select 0건 (시간 관련)
    Evidence: .sisyphus/evidence/task-2-book-modal.txt

  Scenario: 수정 모달에서 initial_time 설정 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "initial_time" src/views/edit-modal.ts
    Expected Result: initial_time이 기존 예약 시간에서 파싱되어 설정
    Evidence: .sisyphus/evidence/task-2-edit-modal.txt

  Scenario: book-type-select.ts 인라인 시간 요소도 timepicker로 변경 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "timepicker" src/listeners/actions/book-type-select.ts
    Expected Result: timepicker 2건 (start, end)
    Evidence: .sisyphus/evidence/task-2-book-type-select.txt
  ```

  **Commit**: YES (groups with Task 1, 3, 4)

---

- [ ] 3. 모든 submission handler selected_time 파싱 (3개 파일)

  **What to do**:
  - **`src/listeners/views/book-submit.ts`** (lines 38-39):
    ```typescript
    // BEFORE
    const startTimeStr = values['start_time_block']?.['start_time_input']?.selected_option?.value;
    const endTimeStr = values['end_time_block']?.['end_time_input']?.selected_option?.value;
    
    // AFTER
    const startTimeStr = values['start_time_block']?.['start_time_input']?.selected_time;
    const endTimeStr = values['end_time_block']?.['end_time_input']?.selected_time;
    ```
  - **`src/listeners/views/recurring-submit.ts`** (lines 93-94): 동일 패턴 변경
  - **`src/listeners/views/edit-submit.ts`** (lines 193-194): 동일 패턴 변경

  **Must NOT do**:
  - `parseDateTimeString()` 변경 금지 — HH:mm 형식 동일
  - 시간 validation 로직 변경 금지 — 기존 그대로 유지
  - `now-book-submit.ts` 변경 금지 — duration 셀렉터 사용

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 2 완료 후)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/listeners/views/book-submit.ts:38-39` — 현재 `selected_option?.value` 패턴
  - `src/listeners/views/recurring-submit.ts:93-94` — 동일 패턴
  - `src/listeners/views/edit-submit.ts:193-194` — 동일 패턴

  **API/Type References**:
  - Bolt.js `ViewStateValue.selected_time`: `string | null | undefined` (HH:mm 형식)
  - `parseDateTimeString(dateStr, timeStr)` — 시간 형식 변경 없으므로 그대로 동작

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: selected_option이 완전히 제거되었는지 확인 (시간 관련)
    Tool: Bash (grep)
    Steps:
      1. grep -n "selected_option" src/listeners/views/book-submit.ts
      2. grep -n "selected_option" src/listeners/views/recurring-submit.ts
      3. grep -n "selected_option" src/listeners/views/edit-submit.ts
    Expected Result: 시간 관련 selected_option 사용 0건 (다른 필드의 selected_option은 유지)
    Evidence: .sisyphus/evidence/task-3-selected-time.txt

  Scenario: selected_time 사용 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "selected_time" src/listeners/views/book-submit.ts
      2. grep -n "selected_time" src/listeners/views/recurring-submit.ts
      3. grep -n "selected_time" src/listeners/views/edit-submit.ts
    Expected Result: 각 파일에 selected_time 2건씩 (start, end)
    Evidence: .sisyphus/evidence/task-3-selected-time-present.txt
  ```

  **Commit**: YES (groups with Task 1, 2, 4)

---

- [ ] 4. 모달 리빌드 시 시간 값 보존 (2개 파일)

  **What to do**:
  - **`src/listeners/actions/guest-select.ts`** (lines 78-83, 95-96):
    - 현재: `values[...].selected_option` 객체를 추출하여 `initialValues`에 전달
    - 변경: `values[...].selected_time` (string)을 추출하여 `initialValues`에 전달
  - **`src/listeners/commands/recurring.ts`** (lines 36-37, 47-48):
    - 동일한 패턴 변경

  **핵심**: 사용자가 시간을 선택한 후 게스트 토글을 클릭하면 모달이 리빌드됨. 이때 선택한 시간이 유지되어야 함.

  **Must NOT do**:
  - 게스트 선택 로직 자체 변경 금지
  - 다른 initialValues (room, date 등) 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 2 완료 후)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/listeners/actions/guest-select.ts:78-96` — 현재 시간 값 추출 및 모달 리빌드 패턴
  - `src/listeners/commands/recurring.ts:36-48` — 동일 패턴

  **API/Type References**:
  - Task 2에서 변경된 `BookModalOptions.initialValues.startTime/endTime` 타입 (string)
  - Task 2에서 변경된 `RecurringModalOptions.initialValues.startTime/endTime` 타입 (string)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: guest-select에서 시간 보존 코드 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "selected_time" src/listeners/actions/guest-select.ts
    Expected Result: selected_time 추출 코드 존재
    Evidence: .sisyphus/evidence/task-4-guest-select.txt

  Scenario: recurring 커맨드에서 시간 보존 코드 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "selected_time" src/listeners/commands/recurring.ts
    Expected Result: selected_time 추출 코드 존재
    Evidence: .sisyphus/evidence/task-4-recurring-cmd.txt
  ```

  **Commit**: YES (groups with Task 1, 2, 3)

---

- [ ] 5. notification-scheduler.ts 생성

  **What to do**:
  - `src/services/notification-scheduler.ts` 새 파일 생성
  - 구현 내용:
    1. `startNotificationScheduler(client: WebClient)` — 메인 함수. `setInterval(60000)`으로 매분 실행
    2. `checkUpcomingEvents(client)` — 모든 ROOMS 순회, `listRoomEvents()` 호출 (Promise.allSettled)
    3. 이벤트 필터링: 현재 시각 기준 시작/종료 5분전 또는 10분전인 이벤트
    4. 중복 방지: `Set<string>` — 키 형식 `${eventId}:${type}` (type = start-10, start-5, end-10, end-5)
    5. `sendReminderDm(client, event, type)` — 참석자에게 DM 전송
    6. 매일 자정에 dedup Set 초기화 (stale entry 방지)
  
  **알림 메시지 형식** (한국어):
  - 시작 10분 전: `🔔 *[L1] 주간 미팅* 이 10분 후에 시작됩니다.\n🕐 14:00 ~ 15:00`
  - 시작 5분 전: `🔔 *[L1] 주간 미팅* 이 5분 후에 시작됩니다.\n🕐 14:00 ~ 15:00`
  - 종료 10분 전: `⏰ *[L1] 주간 미팅* 종료 10분 전입니다.\n🕐 14:00 ~ 15:00`
  - 종료 5분 전: `⏰ *[L1] 주간 미팅* 종료 5분 전입니다.\n🕐 14:00 ~ 15:00`

  **Edge Case 처리**:
  - 회의 시간 < 10분 → end-10 알림 건너뛰기 (시작 전에 종료 알림이 가면 혼란)
  - 회의 시간 < 5분 → end-5 알림도 건너뛰기
  - attendees 빈 배열 → 알림 건너뛰기 (freeBusy fallback 이벤트)
  - `@resource.calendar.google.com` 이메일 → 수신자에서 제외
  - admin 이메일 (`env.google.adminEmail`) → 수신자에서 제외
  - 한 room 쿼리 실패 → 로깅만, 다른 room 계속 처리

  **Must NOT do**:
  - 외부 DB/Redis 추가 금지
  - node-cron 등 외부 의존성 추가 금지
  - 기존 notification.ts 수정 금지
  - 서버 재시작 후 소급 알림 발송 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/services/notification.ts:63-83` — `sendDmToAttendees()` 패턴 (email → userId → DM). 이 패턴을 복사/재사용.
  - `src/services/calendar.ts` — `listRoomEvents(roomId, date)` 함수 시그니처. 오늘 날짜로 호출.
  - `src/config/rooms.ts` — `ROOMS` 배열. 모든 방 순회에 사용.

  **API/Type References**:
  - `BookingEvent` 타입 (`src/types/index.ts`) — eventId, summary, startTime, endTime, attendees, roomName 필드 사용
  - `WebClient` 타입 (`@slack/web-api`) — `client.chat.postMessage`, `client.users.lookupByEmail`
  - `BOT_DISPLAY_NAME` (`src/config/env.ts`) — 메시지에 username 포함

  **External References**:
  - `formatTimeRange()` (`src/views/common.ts:54-62`) — 시간 범위 포맷에 재사용

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 스케줄러 파일이 올바른 export를 가지는지 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "export.*function.*startNotificationScheduler" src/services/notification-scheduler.ts
    Expected Result: export 함수 1건
    Evidence: .sisyphus/evidence/task-5-export.txt

  Scenario: 중복 방지 로직 존재 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "sentNotifications\|dedup\|Set<string>" src/services/notification-scheduler.ts
    Expected Result: dedup Set 관련 코드 존재
    Evidence: .sisyphus/evidence/task-5-dedup.txt

  Scenario: Promise.allSettled 사용 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "allSettled" src/services/notification-scheduler.ts
    Expected Result: Promise.allSettled 사용 1건 이상
    Evidence: .sisyphus/evidence/task-5-allsettled.txt

  Scenario: 짧은 회의 가드 조건 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "duration\|짧은\|short" src/services/notification-scheduler.ts
    Expected Result: 회의 시간 기반 필터링 코드 존재
    Evidence: .sisyphus/evidence/task-5-short-meeting.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat: 회의 시작/종료 전 자동 알림 스케줄러 추가 (10분, 5분 전 DM 알림)`
  - Files: `src/services/notification-scheduler.ts`, `src/app.ts`

---

- [ ] 6. app.ts에 스케줄러 등록

  **What to do**:
  - `src/app.ts`에서 `startNotificationScheduler` import
  - `app.start().then()` 블록 내에서 호출:
    ```typescript
    import { startNotificationScheduler } from './services/notification-scheduler.js';
    
    app.start().then(() => {
      console.log('⚡ Slack 미팅룸 예약봇이 시작되었습니다!');
      warmUpSlackUserCache(app.client).catch(...);
      startNotificationScheduler(app.client);  // 추가
    });
    ```

  **Must NOT do**:
  - 기존 `warmUpSlackUserCache` 호출 변경 금지
  - 기존 app 설정 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 7
  - **Blocked By**: Task 5

  **References**:
  - `src/app.ts:18-21` — 현재 `app.start().then()` 블록

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 스케줄러 등록 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "startNotificationScheduler" src/app.ts
    Expected Result: import 1건 + 호출 1건
    Evidence: .sisyphus/evidence/task-6-registered.txt
  ```

  **Commit**: YES (groups with Task 5)

---

- [ ] 7. 빌드 검증 + 커밋 + 푸시

  **What to do**:
  - `npx tsc --noEmit` 실행 — 에러 0건 확인
  - 두 개 커밋:
    1. timepicker 관련 (Tasks 1-4): `feat: timepicker 마이그레이션 — 30분 단위 드롭다운을 네이티브 timepicker로 교체`
    2. 알림 스케줄러 관련 (Tasks 5-6): `feat: 회의 시작/종료 전 자동 알림 스케줄러 추가 (10분, 5분 전 DM 알림)`
  - `git push`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Blocked By**: Tasks 3, 4, 6

  **Acceptance Criteria**:
  ```
  Scenario: 빌드 성공
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
    Expected Result: 에러 0건
    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

---

- [ ] 8. 전체 검증

  **What to do**:
  - timepicker 관련:
    - 모든 모달 파일에 `static_select` + 시간 관련 코드가 없는지 확인
    - 모든 submission handler에 `selected_time` 사용 확인
    - `generateTimeOptions` 관련 dead code 없는지 확인
  - 알림 스케줄러 관련:
    - notification-scheduler.ts에 필수 함수/로직 모두 존재 확인
    - app.ts에 스케줄러 등록 확인
    - 중복 방지, 에러 처리, 짧은 회의 처리 로직 확인

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Blocked By**: Task 7

  **Acceptance Criteria**:
  ```
  Scenario: static_select 시간 요소 완전 제거 확인
    Tool: Bash (grep)
    Steps:
      1. grep -rn "generateTimeOptions\|generateEditTimeOptions\|generateTimeOptionsInline" src/
    Expected Result: 0건
    Evidence: .sisyphus/evidence/task-8-no-old-time.txt

  Scenario: 모든 시간 파싱이 selected_time 사용 확인
    Tool: Bash (grep)
    Steps:
      1. grep -rn "selected_time" src/listeners/
    Expected Result: book-submit, recurring-submit, edit-submit, guest-select, recurring.ts 에 존재
    Evidence: .sisyphus/evidence/task-8-selected-time.txt

  Scenario: 스케줄러 핵심 기능 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n "setInterval\|allSettled\|sentNotifications\|startNotificationScheduler" src/services/notification-scheduler.ts
    Expected Result: 각 패턴 최소 1건
    Evidence: .sisyphus/evidence/task-8-scheduler.txt
  ```

---

## Commit Strategy

| # | Message | Files | Pre-commit |
|---|---------|-------|-----------|
| 1 | `feat: timepicker 마이그레이션 — 30분 단위 드롭다운을 네이티브 timepicker로 교체` | common.ts, book-modal.ts, recurring-modal.ts, edit-modal.ts, book-type-select.ts, book-submit.ts, recurring-submit.ts, edit-submit.ts, guest-select.ts, recurring.ts | `npx tsc --noEmit` |
| 2 | `feat: 회의 시작/종료 전 자동 알림 스케줄러 추가 (10분, 5분 전 DM 알림)` | notification-scheduler.ts, app.ts | `npx tsc --noEmit` |

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit           # Expected: 에러 0건
grep -r "generateTimeOptions" src/   # Expected: 0건
grep -r "selected_time" src/listeners/  # Expected: 7+ 건
grep -r "startNotificationScheduler" src/  # Expected: 2건 (import + call)
```

### Final Checklist
- [ ] 모든 모달에서 timepicker 렌더링
- [ ] 30분 단위가 아닌 시간으로 예약 가능
- [ ] 게스트 토글 시 시간 보존
- [ ] 스케줄러 매분 실행
- [ ] 시작/종료 전 10분/5분 DM 알림
- [ ] 중복 알림 방지
- [ ] 짧은 회의 edge case 처리
- [ ] 빌드 에러 0건
