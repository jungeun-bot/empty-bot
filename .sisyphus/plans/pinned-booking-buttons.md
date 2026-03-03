# 채널 고정 메시지 - 예약/수정·취소 버튼 추가

## TL;DR

> **Quick Summary**: 기존 Slack Bolt 회의실 예약봇에 채널 고정(Pin) 메시지를 추가하여, 사용자가 채널 진입 시 버튼 클릭만으로 예약/수정·취소 모달을 열 수 있도록 한다. 기존 모달 UI와 예약 로직을 100% 재활용하며, 새 코드는 ~120줄 수준.
> 
> **Deliverables**:
> - `/setup-booking` 셋업 커맨드 (메시지 게시 + 핀 고정)
> - 예약/수정·취소 버튼이 포함된 Block Kit 고정 메시지
> - 버튼 클릭 시 기존 모달을 여는 액션 핸들러
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
슬랙 회의실 예약/변경/취소가 가능한 워크플로를 만들되, 워크플로의 실행 버튼이 해당 채널을 들어가자마자 항상 보이도록 고정(Pin) 메시지 방식으로 구현.

### Interview Summary
**Key Discussions**:
- **기술 스택**: 기존 Slack Bolt (TypeScript) 봇이 Render에 호스팅되어 있음
- **기존 기능**: `/book`, `/edit`, `/now-book` 슬래시 커맨드로 예약/수정/취소 로직 완성됨
- **접근 방식**: Bolt 모달 UI + 채널 고정(Pin) 메시지 방식 합의
- **버튼 구성**: 예약 + 수정·취소 (기존 `/edit`가 수정+취소 통합 흐름이므로)
- **필수 정보**: 회의 이름, 날짜/시간, 회의실, 참석자 수, 참석자 (기존 모달에 이미 구현됨)

**Research Findings**:
- 기존 코드베이스가 잘 구조화된 TypeScript 모듈 패턴 사용
- `buildBookModal(channelId)`, `buildDateRoomSelectModal()` 뷰 빌더를 그대로 재활용 가능
- 핀 메시지의 버튼도 일반 `block_actions` 이벤트를 정상 발생시킴
- `trigger_id`는 ~3초 내에 `views.open` 호출 필요

### Metis Review
**Identified Gaps** (addressed):
- **`pins:write` OAuth 스코프 누락**: 현재 앱에 해당 스코프 없음 → 사전 준비 단계로 문서화
- **Slack 관리자 패널 커맨드 등록 필요**: `/setup-booking` 수동 등록 필요 → 사전 준비 단계로 문서화
- **`already_pinned` 에러 처리**: 중복 실행 시 그레이스풀 처리 필요 → 에러 핸들링에 포함
- **`body.channel?.id` 옵셔널 체이닝**: 액션 핸들러에서 채널 ID가 옵셔널 → 안전한 추출 패턴 적용
- **`trigger_id` 3초 만료**: `ack()` 직후 `views.open` 호출 필수 → 구현 지침에 포함
- **접근 제어 미정**: 기본값 = 모든 사용자 실행 가능 (심플 구현)
- **재실행 동작 미정**: 기본값 = 새 메시지 게시 + 핀, 에러 시 안내 메시지

---

## Work Objectives

### Core Objective
채널 고정 메시지에 예약/수정·취소 버튼을 배치하여, 슬래시 커맨드 없이도 버튼 클릭으로 기존 예약 모달을 열 수 있는 대체 UI 진입점을 제공한다.

### Concrete Deliverables
- `src/views/setup-panel-message.ts` — 고정 메시지 Block Kit 뷰 빌더
- `src/listeners/commands/setup-booking.ts` — 셋업 커맨드 핸들러
- `src/listeners/actions/setup-panel.ts` — 버튼 액션 핸들러 (2개)
- `src/listeners/commands/index.ts` 수정 — 새 커맨드 등록
- `src/listeners/actions/index.ts` 수정 — 새 액션 등록

### Definition of Done
- [ ] `npx tsc --noEmit` — 타입 에러 0개
- [ ] `npm run build` — 빌드 성공
- [ ] `/setup-booking` 실행 → 채널에 버튼 메시지 게시 + 핀 고정
- [ ] 예약 버튼 클릭 → 기존 예약 모달(`book_modal`) 정상 오픈
- [ ] 수정·취소 버튼 클릭 → 기존 수정 모달(`edit_date_room_select`) 정상 오픈

### Must Have
- 채널에 고정되는 Block Kit 메시지 (예약 + 수정·취소 버튼 2개)
- `/setup-booking` 커맨드로 메시지 게시 + 자동 핀 고정
- 버튼 클릭 시 기존 `buildBookModal()`, `buildDateRoomSelectModal()` 모달 열기
- `already_pinned`, `too_many_pins`, `not_in_channel` 에러 그레이스풀 처리
- 기존 예약 흐름과 100% 호환 (모달 → 예약 생성 → 성공 메시지)

### Must NOT Have (Guardrails)
- 기존 `listeners/commands/`, `listeners/actions/`, `listeners/views/`의 기존 핸들러 수정 금지
- 기존 `views/` 뷰 빌더 수정 금지
- `PendingBooking` 타입이나 `pendingBookings` Map 수정 금지
- `package.json`에 새 dependency 추가 금지
- 새로운 모달 뷰 생성 금지 — 기존 모달만 재활용
- 메시지 `ts` 영구 저장소 구현 금지 (over-engineering)
- `/now-book` 세 번째 버튼 추가 금지 (인원수 인자 필요하여 버튼 패턴 부적합)
- 환경변수로 메시지 텍스트 설정 금지 (하드코드, 기존 스타일 일관성)
- 관리자 접근 제어 로직 금지 (scope creep)
- 고정 메시지 삭제/정리 커맨드 금지 (scope creep)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: N/A

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **TypeScript/Build**: Use Bash — `npx tsc --noEmit`, `npm run build`
- **Code Pattern**: Use Grep/AST — action_id 충돌 확인, 등록 확인

---

## Execution Strategy

### Pre-Flight Checklist (수동 — 코드 작업 전 완료 필요)

> ⚠️ 아래 두 단계는 Slack 관리자 패널에서 수동으로 수행해야 합니다.
> 코드 구현 전에 완료되어야 기능이 정상 작동합니다.

1. **`pins:write` OAuth 스코프 추가**
   - https://api.slack.com/apps → 해당 앱 선택
   - OAuth & Permissions → Bot Token Scopes → `pins:write` 추가
   - 앱을 워크스페이스에 **재설치** (Reinstall to Workspace)

2. **`/setup-booking` 슬래시 커맨드 등록**
   - https://api.slack.com/apps → 해당 앱 선택
   - Features → Slash Commands → Create New Command
   - Command: `/setup-booking`
   - Request URL: Socket Mode이므로 자동 처리됨
   - Short Description: `채널에 예약 버튼 패널을 설치합니다`

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 3 parallel tasks):
├── Task 1: Block Kit 고정 메시지 뷰 빌더 생성 [quick]
├── Task 2: 버튼 액션 핸들러 생성 (예약/수정·취소) [quick]
└── Task 3: /setup-booking 커맨드 핸들러 + 등록 배선 [quick]

Wave 2 (After Wave 1 — 빌드 검증):
└── Task 4: TypeScript 빌드 검증 + 통합 확인 [quick]

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 4 → FINAL
Parallel Speedup: Wave 1에서 3개 동시 실행
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3 | 1 |
| 2 | — | 4 | 1 |
| 3 | 1 | 4 | 1 |
| 4 | 1, 2, 3 | FINAL | 2 |
| F1-F4 | 4 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2**: **1** — T4 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs


- [ ] 1. Block Kit 고정 메시지 뷰 빌더 생성

  **What to do**:
  - `src/views/setup-panel-message.ts` 파일 생성
  - `buildSetupPanelMessage()` 함수 구현: Block Kit `actions` 블록으로 버튼 2개 포함한 메시지 반환
  - 버튼 1: 📝 예약하기 (`action_id: 'open_book_modal'`, style: `primary`)
  - 버튼 2: ✏️ 수정/취소 (`action_id: 'open_edit_modal'`)
  - 상단에 안내 텍스트 섹션 포함 (예: `*🏢 회의실 예약 시스템*\n아래 버튼을 클릭하여 회의실을 예약하거나 기존 예약을 수정/취소할 수 있습니다.`)
  - `divider` 블록으로 안내 텍스트와 버튼 분리
  - 반환 타입: `KnownBlock[]` (from `@slack/types`)
  - **CRITICAL**: `input` 블록이 아닌 `actions` 블록 사용 필수 — `input` 블록은 클릭 이벤트를 발생시키지 않음
  - **CRITICAL**: 모든 Block Kit 타입 리터럴에 `as const` assertion 사용 (기존 패턴 준수)

  **Must NOT do**:
  - 새로운 모달 뷰 생성 금지
  - 환경변수 기반 텍스트 설정 금지
  - `/now-book` 용 세 번째 버튼 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 생성, Block Kit JSON 구성만 필요한 소규모 작업
  - **Skills**: []
    - 추가 스킬 불필요 — 기존 뷰 빌더 패턴 참조만으로 충분

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 3 (setup command에서 이 뷰 빌더를 import)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/views/now-book-message.ts:9-52` — 채널 메시지용 Block Kit 블록 배열 반환 패턴 (`object[]` 반환, `actions` 블록 사용, `divider` 사용). 이 파일의 구조를 따라 블록 배열을 구성할 것
  - `src/views/book-modal.ts:25-155` — Block Kit `as const` assertion 패턴, 타입 리터럴 스타일. 모든 `type` 필드에 `as const`를 붙이는 컨벤션 확인용
  - `src/views/result-views.ts:4-42` — `buildRoomSelectMessage()`의 `accessory.button` 패턴. 버튼에 `style: 'primary'`, `action_id`, `text.emoji: true` 사용 방법 참고

  **API/Type References** (contracts to implement against):
  - `@slack/types` — `KnownBlock` 타입 (import 참조). 채널 메시지의 blocks 배열 타입으로 사용
  - Slack Block Kit Reference: `actions` 블록 내 `button` 엘리먼트 스펙

  **WHY Each Reference Matters**:
  - `now-book-message.ts`: 이 프로젝트에서 채널 메시지(모달이 아닌)용 블록을 생성하는 유일한 패턴. 함수 시그니처와 반환 형식을 따를 것
  - `book-modal.ts`: `as const` assertion 컨벤션의 정본. 새 파일도 동일 스타일 적용 필수
  - `result-views.ts`: `button` 엘리먼트의 실제 사용 예시. `style`, `text`, `action_id` 구성 방법 확인

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 뷰 빌더 파일이 TypeScript 컴파일을 통과한다
    Tool: Bash
    Preconditions: npm install 완료
    Steps:
      1. npx tsc --noEmit 실행
    Expected Result: exit code 0, 에러 출력 없음
    Failure Indicators: TypeScript 컴파일 에러 메시지 출력
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt

  Scenario: action_id 값이 기존 코드와 충돌하지 않는다
    Tool: Bash (grep)
    Preconditions: 파일 생성 완료
    Steps:
      1. grep -r 'open_book_modal' src/ 실행 → 결과가 정확히 1개 파일(setup-panel-message.ts)에서만 나와야 함 (action handler 추가 전)
      2. grep -r 'open_edit_modal' src/ 실행 → 결과가 정확히 1개 파일에서만 나와야 함
    Expected Result: 각 action_id가 새 파일에서만 발견됨 (이후 Task 2에서 핸들러 추가 시 2개)
    Failure Indicators: 기존 파일에서 동일 action_id 발견
    Evidence: .sisyphus/evidence/task-1-actionid-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-tsc-check.txt
  - [ ] task-1-actionid-check.txt

  **Commit**: NO (groups with Task 3)

- [ ] 2. 버튼 액션 핸들러 생성 (예약/수정·취소 모달 열기)

  **What to do**:
  - `src/listeners/actions/setup-panel.ts` 파일 생성
  - `registerSetupPanelActions(app: App)` 함수 구현
  - 액션 핸들러 1: `app.action('open_book_modal', ...)` — 예약 모달 열기
    - `await ack()` 호출
    - `body.channel?.id`에서 channelId 추출 (옵셔널 체이닝 필수, 없으면 빈 문자열 fallback)
    - `(body as { trigger_id?: string }).trigger_id`에서 trigger_id 추출
    - **CRITICAL**: `ack()` 직후 즉시 `client.views.open({ trigger_id, view: buildBookModal(channelId) })` 호출 — trigger_id 3초 만료
    - `try/catch`로 감싸고 `logger.error()` 사용
  - 액션 핸들러 2: `app.action('open_edit_modal', ...)` — 수정/취소 모달 열기
    - 동일 패턴, `buildDateRoomSelectModal()` 사용 (파라미터 없음)
  - import: `buildBookModal` from `../../views/book-modal.js`, `buildDateRoomSelectModal` from `../../views/edit-modal.js`

  **Must NOT do**:
  - 기존 `room-select.ts`, `book-type-select.ts` 수정 금지
  - 새로운 모달 뷰 생성 금지
  - `pendingBookings` Map 접근 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 생성, 기존 패턴 복제 수준의 소규모 작업
  - **Skills**: []
    - 추가 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4 (빌드 검증)
  - **Blocked By**: None (can start immediately — 기존 뷰 빌더를 직접 import하므로 Task 1과 독립)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/listeners/actions/room-select.ts:9-91` — 액션 핸들러 등록 패턴: `registerXActions(app: App)` 함수, `app.action('action_id', async ({ ack, action, body, client, logger }) => { ... })`. 특히 `body` 캐스팅 패턴과 `trigger_id` 추출 방법 참고
  - `src/listeners/commands/book.ts:4-17` — `client.views.open({ trigger_id, view: buildBookModal(channelId) })` 호출 패턴. 이 정확한 호출 방식을 액션 핸들러에서 재현
  - `src/listeners/commands/edit.ts:4-16` — `client.views.open({ trigger_id: body.trigger_id, view: buildDateRoomSelectModal() })` 호출 패턴
  - `src/listeners/actions/room-select.ts:126` — `(body as { trigger_id?: string }).trigger_id` 캐스팅 패턴. 액션 핸들러에서 trigger_id를 안전하게 추출하는 방법

  **API/Type References** (contracts to implement against):
  - `src/views/book-modal.ts:3` — `buildBookModal(channelId: string)` 시그니처. channelId 파라미터 필수
  - `src/views/edit-modal.ts:35` — `buildDateRoomSelectModal()` 시그니처. 파라미터 없음

  **WHY Each Reference Matters**:
  - `room-select.ts`: 이 프로젝트에서 `app.action()` 핸들러의 정본. 특히 `body` 타입 캐스팅과 trigger_id 추출이 액션 핸들러 특유의 패턴 (커맨드와 다름)
  - `book.ts`: `views.open` + `buildBookModal` 조합의 실제 사용 예시. 이 호출을 액션 핸들러로 이식하는 것이 핵심
  - `edit.ts`: `views.open` + `buildDateRoomSelectModal` 조합의 실제 사용 예시

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 액션 핸들러 파일이 TypeScript 컴파일을 통과한다
    Tool: Bash
    Preconditions: npm install 완료, Task 1 뷰 빌더 파일 존재
    Steps:
      1. npx tsc --noEmit 실행
    Expected Result: exit code 0, 에러 출력 없음
    Failure Indicators: import 에러 또는 타입 에러 출력
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: open_book_modal 핸들러가 buildBookModal을 올바르게 import한다
    Tool: Bash (grep)
    Preconditions: 파일 생성 완료
    Steps:
      1. grep -n 'buildBookModal' src/listeners/actions/setup-panel.ts 실행
      2. grep -n 'buildDateRoomSelectModal' src/listeners/actions/setup-panel.ts 실행
    Expected Result: 각각 import 라인 + 사용 라인 = 최소 2줄씩 출력
    Failure Indicators: 0줄 출력 (import 누락)
    Evidence: .sisyphus/evidence/task-2-import-check.txt

  Scenario: trigger_id를 ack() 직후에 사용하는 패턴이 적용되었다
    Tool: Bash (grep)
    Preconditions: 파일 생성 완료
    Steps:
      1. grep -A 5 'await ack()' src/listeners/actions/setup-panel.ts 실행
    Expected Result: ack() 직후 2-3줄 이내에 views.open 또는 trigger_id 관련 코드 존재
    Failure Indicators: ack()와 views.open 사이에 긴 비동기 작업이 존재
    Evidence: .sisyphus/evidence/task-2-trigger-pattern.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-tsc-check.txt
  - [ ] task-2-import-check.txt
  - [ ] task-2-trigger-pattern.txt

  **Commit**: NO (groups with Task 3)

- [ ] 3. /setup-booking 커맨드 핸들러 + 등록 배선

  **What to do**:
  - `src/listeners/commands/setup-booking.ts` 파일 생성
  - `registerSetupBookingCommand(app: App)` 함수 구현:
    - `app.command('/setup-booking', async ({ command, ack, client, respond, logger }) => { ... })`
    - `await ack()`
    - `client.chat.postMessage({ channel: command.channel_id, blocks: buildSetupPanelMessage(), text: '회의실 예약 시스템' })` 로 메시지 게시
      - `text` 파라미터는 블록을 지원하지 않는 환경용 fallback
    - 반환된 `result.ts`를 사용해 `client.pins.add({ channel: command.channel_id, timestamp: result.ts })` 호출
    - 에러 핸들링:
      - `already_pinned` 에러 → 무시 (이미 고정됨, 정상 처리)
      - `too_many_pins` 에러 → `respond({ response_type: 'ephemeral', text: '⚠️ 이 채널의 고정 메시지가 너무 많아 핀 고정에 실패했습니다. 기존 핀을 정리해주세요. 메시지는 게시되었습니다.' })`
      - `not_in_channel` 에러 → `respond({ response_type: 'ephemeral', text: '⚠️ 봇이 이 채널에 초대되어 있지 않습니다. 먼저 봇을 채널에 추가해주세요.' })`
      - 기타 에러 → `logger.error` + 사용자 안내 ephemeral 메시지
    - 성공 시 → `respond({ response_type: 'ephemeral', text: '✅ 예약 패널이 설치되었습니다!' })` (실행자에게만 보이는 확인 메시지)
  - `src/listeners/commands/index.ts` 수정:
    - import 추가: `import { registerSetupBookingCommand } from './setup-booking.js';`
    - `registerCommands` 함수 내 호출 추가: `registerSetupBookingCommand(app);`
  - `src/listeners/actions/index.ts` 수정:
    - import 추가: `import { registerSetupPanelActions } from './setup-panel.js';`
    - `registerActions` 함수 내 호출 추가: `registerSetupPanelActions(app);`

  **Must NOT do**:
  - 기존 `registerBookCommand`, `registerEditCommand`, `registerNowBookCommand` 수정 금지
  - 기존 `registerRoomSelectActions`, `registerBookTypeSelectAction` 수정 금지
  - 메시지 ts 저장소 구현 금지
  - 접근 제어(admin only) 로직 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 커맨드 핸들러 1개 생성 + index 파일 2줄씩 수정하는 소규모 작업
  - **Skills**: []
    - 추가 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1 동시 실행 가능하나, Task 1의 뷰 빌더를 import하므로 Task 1 완료 후 실행이 안전)
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4 (빌드 검증)
  - **Blocked By**: Task 1 (buildSetupPanelMessage import 필요)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/listeners/commands/book.ts:1-17` — 커맨드 핸들러의 정본. `registerXCommand(app: App)` 패턴, `app.command('/name', async ({ command, ack, client, logger }) => { await ack(); ... })` 구조를 정확히 따를 것
  - `src/listeners/commands/now-book.ts:13-80` — `respond()` 사용 패턴. ephemeral 응답 보내기: `respond({ response_type: 'ephemeral', text: '...' })`
  - `src/listeners/commands/index.ts:1-10` — 커맨드 등록 배선 패턴: import + registerX(app) 호출. 새 커맨드도 동일하게 추가
  - `src/listeners/actions/index.ts:1-8` — 액션 등록 배선 패턴: 동일하게 새 액션 핸들러 등록 추가

  **API/Type References** (contracts to implement against):
  - Slack Web API `chat.postMessage` — blocks + text 파라미터, 반환값 `result.ts` (메시지 타임스탬프)
  - Slack Web API `pins.add` — channel + timestamp 파라미터
  - `src/views/setup-panel-message.ts` (Task 1) — `buildSetupPanelMessage()` import 대상

  **WHY Each Reference Matters**:
  - `book.ts`: 이 프로젝트의 슬래시 커맨드 핸들러 표준. 구조, 에러 핸들링, ack 패턴 모두 이 파일 기준
  - `now-book.ts`: `respond()` 사용 방법과 ephemeral 응답 패턴의 실전 예시
  - `index.ts` 파일들: 등록 배선의 정확한 위치와 패턴. 한 줄 import + 한 줄 호출만 추가

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 전체 프로젝트가 TypeScript 컴파일을 통과한다
    Tool: Bash
    Preconditions: Task 1, 2, 3 모든 파일 생성/수정 완료, npm install 완료
    Steps:
      1. npx tsc --noEmit 실행
    Expected Result: exit code 0, 에러 출력 없음
    Failure Indicators: import 경로 에러, 타입 에러 등
    Evidence: .sisyphus/evidence/task-3-tsc-check.txt

  Scenario: 새 커맨드와 액션이 index 파일에 정상 등록되었다
    Tool: Bash (grep)
    Preconditions: index 파일 수정 완료
    Steps:
      1. grep 'registerSetupBookingCommand' src/listeners/commands/index.ts 실행
      2. grep 'registerSetupPanelActions' src/listeners/actions/index.ts 실행
    Expected Result: 각 파일에서 import 라인 + 호출 라인 = 2줄씩 출력
    Failure Indicators: 0줄 출력 (등록 누락)
    Evidence: .sisyphus/evidence/task-3-registration-check.txt

  Scenario: pins.add 에러 핸들링이 구현되었다
    Tool: Bash (grep)
    Preconditions: setup-booking.ts 파일 생성 완료
    Steps:
      1. grep -c 'already_pinned\|too_many_pins\|not_in_channel' src/listeners/commands/setup-booking.ts 실행
    Expected Result: 3 이상 (각 에러 케이스에 대한 처리)
    Failure Indicators: 0 (에러 핸들링 누락)
    Evidence: .sisyphus/evidence/task-3-error-handling-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-tsc-check.txt
  - [ ] task-3-registration-check.txt
  - [ ] task-3-error-handling-check.txt

  **Commit**: YES
  - Message: `feat(booking): add pinned channel message with booking/edit buttons`
  - Files: `src/views/setup-panel-message.ts`, `src/listeners/commands/setup-booking.ts`, `src/listeners/actions/setup-panel.ts`, `src/listeners/commands/index.ts`, `src/listeners/actions/index.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 4. TypeScript 빌드 검증 + 통합 확인

  **What to do**:
  - `npx tsc --noEmit` 실행 → 타입 에러 0개 확인
  - `npm run build` 실행 → `dist/` 디렉토리에 컴파일된 JS 파일 생성 확인
  - `npm run dev` 실행 → 봇 시작 메시지 확인 후 종료
  - 전체 action_id 유니크 검증: `grep -roh "action_id: '[^']*'" src/ | sort | uniq -d` → 중복 없어야 함
  - 전체 callback_id 유니크 검증: `grep -roh "callback_id: '[^']*'" src/ | sort | uniq -d` → 중복 없어야 함
  - 빌드 에러 발견 시 해당 파일 수정하여 해결

  **Must NOT do**:
  - 기존 로직 수정으로 빌드 에러 해결 금지 — 새 파일만 수정

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 빌드 명령어 실행 + 결과 확인만 하는 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: FINAL Wave
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `package.json:10-12` — 빌드/실행 스크립트: `dev`, `build`, `start`
  - `tsconfig.json:1-19` — TypeScript 컴파일러 설정 (strict: true, outDir: dist)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript 컴파일이 에러 없이 통과한다
    Tool: Bash
    Preconditions: 모든 Task 1-3 완료
    Steps:
      1. cd C:\Users\황병하\slack-room-bot && npx tsc --noEmit
    Expected Result: exit code 0, stdout에 에러 없음
    Failure Indicators: error TS로 시작하는 라인이 존재
    Evidence: .sisyphus/evidence/task-4-tsc-noEmit.txt

  Scenario: npm run build가 성공한다
    Tool: Bash
    Preconditions: tsc --noEmit 통과
    Steps:
      1. cd C:\Users\황병하\slack-room-bot && npm run build
      2. ls dist/views/setup-panel-message.js 확인
      3. ls dist/listeners/commands/setup-booking.js 확인
      4. ls dist/listeners/actions/setup-panel.js 확인
    Expected Result: 3개 새 JS 파일이 dist/ 에 존재
    Failure Indicators: 파일 미존재 또는 빌드 에러
    Evidence: .sisyphus/evidence/task-4-build-output.txt

  Scenario: action_id와 callback_id에 충돌이 없다
    Tool: Bash (grep)
    Preconditions: 빌드 성공
    Steps:
      1. grep -roh "action_id: '[^']*'" src/ | sort | uniq -d 실행
      2. grep -roh "callback_id: '[^']*'" src/ | sort | uniq -d 실행
    Expected Result: 두 명령 모두 빈 출력 (중복 없음)
    Failure Indicators: 중복된 ID가 출력됨
    Evidence: .sisyphus/evidence/task-4-id-collision-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-4-tsc-noEmit.txt
  - [ ] task-4-build-output.txt
  - [ ] task-4-id-collision-check.txt

  **Commit**: NO (이미 Task 3에서 커밋됨. 빌드 에러 수정 시에만 추가 커밋)
  - If fix needed: `fix(booking): resolve build errors in setup panel`


## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, grep codebase). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit`. Review all new/changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify `as const` assertions on Block Kit type literals match existing pattern. Verify `snake_case` action_id naming convention.
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Run `npm run build` and verify success. Run `npm run dev` and verify "⚡ Slack 회의실 예약봇이 시작되었습니다!" appears. Grep for action_id collisions. Verify all new files follow existing patterns. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Build [PASS/FAIL] | Dev Start [PASS/FAIL] | Patterns [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no existing handler modifications, no new dependencies, no new modal views. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Scope [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Single Commit** (all tasks): `feat(booking): add pinned channel message with booking/edit buttons` — all new + modified files, `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit       # Expected: exit 0, no errors
npm run build           # Expected: exit 0, dist/ generated
npm run dev             # Expected: "⚡ Slack 회의실 예약봇이 시작되었습니다!" in stdout
```

### Final Checklist
- [ ] 3 new files created (view builder + command handler + action handlers)
- [ ] 2 existing files minimally modified (commands/index.ts + actions/index.ts)
- [ ] No existing handlers modified
- [ ] No new dependencies added
- [ ] TypeScript builds without errors
- [ ] action_id values unique across codebase
- [ ] All new code follows existing patterns (registerX, try/catch, logger.error, as const)
