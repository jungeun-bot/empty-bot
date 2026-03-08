# 예약 현황 조회 기능 추가

## TL;DR

> **Quick Summary**: 설치 패널에 📊 현황 버튼을 추가하고, 날짜+회의실을 선택하면 해당 일의 예약 현황을 한눈에 보여주는 모달 기능 구현
> 
> **Deliverables**:
> - 설치 패널에 📊 현황 버튼
> - 날짜/회의실 선택 모달
> - 예약 현황 결과 모달 (시간표 형태)
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential (4 tasks)
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
사용자가 설치 패널에서 현황 버튼을 누르면, 날짜와 회의실을 선택하여 예약 현황을 한눈에 볼 수 있는 기능.

### Research Findings
- `listRoomEvents(roomId, date)` 함수가 `src/services/calendar.ts`에 이미 존재 → Google Calendar에서 특정 방의 특정 날짜 이벤트를 조회할 수 있음
- 설치 패널 버튼 패턴: `setup-panel-message.ts`에서 action_id로 버튼 정의, `setup-panel.ts`에서 핸들러 등록
- 모달 패턴: `edit-modal.ts`의 `buildDateRoomSelectModal()` 참고 (datepicker + select)
- 결과 표시 패턴: `edit-submit.ts`에서 `ack({ response_action: 'update', view: ... })` 으로 모달 업데이트

---

## Work Objectives

### Core Objective
설치 패널에 📊 현황 버튼 추가, 클릭 시 날짜/회의실 선택 모달 → 제출 시 예약 현황 결과 모달 표시

### Must Have
- 날짜 선택 (datepicker, 기본값: 오늘)
- 회의실 선택 (전체 / 개별 선택)
- 전체 선택 시 모든 회의실의 예약 현황 표시
- 개별 선택 시 해당 회의실만 표시
- 각 예약별 시간, 회의명, 주최자 표시

### Must NOT Have
- 예약 수정/삭제 기능 (이건 /수정 커맨드의 역할)
- 새 슬래시 커맨드 추가 (모달 버튼으로만 접근)

---

## Verification Strategy

### Test Decision
- **Automated tests**: None (기존 프로젝트에 테스트 인프라 없음)
- **Framework**: None

### QA Policy
- TypeScript 빌드 (`npx tsc`) 성공 확인
- 모든 파일 import/export 연결 확인

---

## Execution Strategy

### Sequential (4 tasks)

```
Task 1: 현황 모달 UI 파일 생성
Task 2: 현황 조회 결과 핸들러 생성
Task 3: 설치 패널 버튼 + 액션 핸들러 추가
Task 4: 등록 + 빌드 + 커밋
```

---

## TODOs

- [ ] 1. 현황 모달 UI 생성 (`src/views/status-modal.ts`)

  **What to do**:
  - `src/views/status-modal.ts` 파일 신규 생성
  - `buildStatusModal(channelId?: string)` 함수 export
  - 모달 구성:
    - `callback_id: 'status_modal'`
    - `title: '📊 예약 현황 조회'`
    - `submit: '조회'`, `close: '닫기'`
    - `private_metadata: JSON.stringify({ channelId })`
    - Block 1: `input` → `datepicker` (action_id: `date_input`, initial_date: 오늘 KST)
    - Block 2: `input` → `static_select` (action_id: `room_input`)
      - 첫 옵션: `{ text: '📋 전체 회의실', value: 'all' }`
      - 나머지: ROOMS 배열에서 각 방을 옵션으로 생성 (미팅룸은 🏢, 포커스룸은 🎯 이모지 prefix)
      - 각 옵션 value: room.id (Google Calendar resource email)
  - import: `ROOMS` from `../config/rooms.js`

  **Must NOT do**:
  - 다른 파일 수정하지 말 것 (이 태스크에서는 status-modal.ts만 생성)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **References**:
  - `src/views/edit-modal.ts:buildDateRoomSelectModal()` — datepicker + select 모달 패턴 참고
  - `src/views/recurring-modal.ts:buildRecurringModal()` — 모달 구조 패턴 참고
  - `src/config/rooms.ts` — ROOMS 배열 import 방법

  **Acceptance Criteria**:
  - [ ] `src/views/status-modal.ts` 파일 존재
  - [ ] `buildStatusModal` 함수 export
  - [ ] `npx tsc --noEmit` 성공

  **Commit**: NO (Task 4에서 일괄)

---

- [ ] 2. 현황 조회 결과 핸들러 생성 (`src/listeners/views/status-submit.ts`)

  **What to do**:
  - `src/listeners/views/status-submit.ts` 파일 신규 생성
  - `registerStatusSubmit(app: App)` 함수 export
  - `app.view('status_modal', ...)` 핸들러 등록
  - 핸들러 로직:
    1. `ack({ response_action: 'update', view: buildProcessingView() })` → 로딩 표시
    2. `view.state.values`에서 날짜(`date_block.date_input.selected_date`)와 방(`room_block.room_input.selected_option.value`) 추출
    3. 방 선택 분기:
       - `'all'`: ROOMS 전체를 대상으로 반복
       - 개별 room.id: 해당 방만 조회
    4. 각 방에 대해 `listRoomEvents(roomId, date)` 호출
    5. 결과를 Slack Block Kit으로 포맷:
       - 각 회의실별 section block
       - 회의실 이름 + 수용인원 (bold header)
       - 예약 없으면: "예약 없음 ✅"
       - 예약 있으면: 각 예약을 `HH:MM~HH:MM 회의명 (주최자)` 형태로 나열
       - 회의실 사이 divider
    6. `client.views.update({ view_id, view: 결과모달 })` 로 모달 업데이트
    7. 에러 시 `buildErrorView()` 사용

  **시간 포맷**:
  - startTime, endTime을 KST `HH:MM` 형태로 변환
  - 예: `09:00~10:00 주간회의 (kim@company.com)`

  **결과 모달 구조**:
  ```
  title: '📊 예약 현황'
  blocks:
    section: "📅 2026-03-08 (월) 예약 현황"
    divider
    section: "🏢 *Meeting Room 1* (12인)"
    section: "  09:00~10:00  주간회의 (kim@brfst.kr)\n  14:00~15:00  기획미팅 (lee@brfst.kr)"
    divider
    section: "🏢 *Meeting Room 2* (16인)"
    section: "  예약 없음 ✅"
    ...
  ```

  **Must NOT do**:
  - 다른 파일 수정하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **References**:
  - `src/listeners/views/edit-submit.ts:22-104` — view submission 핸들러 패턴 (ack update, values 추출, views.update)
  - `src/services/calendar.ts:listRoomEvents()` — 방별 이벤트 조회 함수 (roomId: string, date: Date) → BookingEvent[]
  - `src/types/index.ts:BookingEvent` — 이벤트 타입 (summary, startTime, endTime, organizer, creator)
  - `src/views/result-views.ts:buildProcessingView(), buildErrorView()` — 로딩/에러 뷰 빌더
  - `src/config/rooms.ts:ROOMS, getRoomById()` — 방 목록 및 ID로 방 정보 조회

  **Acceptance Criteria**:
  - [ ] `src/listeners/views/status-submit.ts` 파일 존재
  - [ ] `registerStatusSubmit` 함수 export
  - [ ] `npx tsc --noEmit` 성공

  **Commit**: NO (Task 4에서 일괄)

---

- [ ] 3. 설치 패널 버튼 + 액션 핸들러 추가

  **What to do**:

  **(A) 설치 패널 버튼 추가** (`src/views/setup-panel-message.ts`):
  - `elements` 배열 마지막(정기회의 버튼 뒤)에 현황 버튼 추가:
    ```typescript
    {
      type: 'button' as const,
      text: {
        type: 'plain_text' as const,
        text: '📊 현황',
        emoji: true,
      },
      action_id: 'open_status_modal',
    },
    ```

  **(B) 액션 핸들러 추가** (`src/listeners/actions/setup-panel.ts`):
  - 파일 상단에 import 추가: `import { buildStatusModal } from '../../views/status-modal.js';`
  - 기존 `open_recurring_modal` 핸들러 아래에 동일 패턴으로 추가:
    ```typescript
    app.action('open_status_modal', async ({ ack, body, client, logger }) => {
      await ack();
      try {
        const channelId = (body as { channel?: { id?: string } }).channel?.id ?? '';
        const triggerId = (body as { trigger_id?: string }).trigger_id;
        if (!triggerId) return;
        await client.views.open({
          trigger_id: triggerId,
          view: buildStatusModal(channelId),
        });
      } catch (error) {
        logger.error('open_status_modal 액션 처리 오류:', error);
      }
    });
    ```

  **Must NOT do**:
  - 기존 버튼 순서 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **References**:
  - `src/views/setup-panel-message.ts:44-52` — 정기회의 버튼 패턴 (동일 구조 복제)
  - `src/listeners/actions/setup-panel.ts:60-76` — open_recurring_modal 핸들러 패턴 (동일 구조 복제)

  **Acceptance Criteria**:
  - [ ] setup-panel-message.ts에 '📊 현황' 버튼 존재
  - [ ] setup-panel.ts에 'open_status_modal' 핸들러 존재
  - [ ] `npx tsc --noEmit` 성공

  **Commit**: NO (Task 4에서 일괄)

---

- [ ] 4. 등록 + 빌드 + 커밋

  **What to do**:
  - `src/listeners/views/index.ts` 수정:
    - `import { registerStatusSubmit } from './status-submit.js';` 추가
    - `registerViews()` 함수 안에 `registerStatusSubmit(app);` 추가
  - `npx tsc` 빌드 실행 → 오류 없음 확인
  - Git 커밋 (commit_fix.mjs 또는 do_commit.mjs 패턴 사용):
    - 대상 파일: `src/views/status-modal.ts`, `src/listeners/views/status-submit.ts`, `src/views/setup-panel-message.ts`, `src/listeners/actions/setup-panel.ts`, `src/listeners/views/index.ts`
    - 커밋 메시지: `feat: 예약 현황 조회 기능 추가 (설치 패널 📊 현황 버튼)`

  **Must NOT do**:
  - push 하지 말 것 (사용자가 GitHub Desktop에서 수동 push)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **References**:
  - `src/listeners/views/index.ts` — registerRecurringSubmit 등록 패턴 참고
  - Git 실행 경로: `"C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe"`
  - Git 커밋은 Node.js 스크립트(do_commit.mjs)로 실행 (Windows cmd.exe에서 export 명령 사용 불가)

  **Acceptance Criteria**:
  - [ ] `npx tsc` 빌드 성공
  - [ ] git commit 성공
  - [ ] `git status`에서 "Your branch is ahead of 'origin/main'"

  **Commit**: YES
  - Message: `feat: 예약 현황 조회 기능 추가 (설치 패널 📊 현황 버튼)`
  - Files: `src/views/status-modal.ts`, `src/listeners/views/status-submit.ts`, `src/views/setup-panel-message.ts`, `src/listeners/actions/setup-panel.ts`, `src/listeners/views/index.ts`

---

## Success Criteria

### Final Checklist
- [ ] 설치 패널에 📊 현황 버튼 표시
- [ ] 버튼 클릭 시 날짜/회의실 선택 모달 열림
- [ ] 전체 회의실 선택 시 모든 방의 현황 표시
- [ ] 개별 회의실 선택 시 해당 방만 표시
- [ ] 예약 있는 방: 시간+회의명+주최자 표시
- [ ] 예약 없는 방: "예약 없음 ✅" 표시
- [ ] TypeScript 빌드 성공
- [ ] Git 커밋 완료

### 사용자 후속 작업
1. GitHub Desktop에서 Push
2. Render 자동 배포 대기
3. 기존 설치 패널 고정 메시지 삭제 → `/설치` 재실행 (새 버튼 반영)
