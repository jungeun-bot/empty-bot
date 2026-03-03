# UX 개선 + 신고/건의 기능: Slack 미팅룸 예약봇

## TL;DR

> **Quick Summary**: (A) `/즉시예약` 모달의 참석자 필드를 `/예약` 모달과 일치시키고, (B) 대화형 예약에서 인원수 대신 참석자를 물어보며, (C) 신고/건의 기능을 신규 추가
> 
> **Deliverables**:
> - `/즉시예약` 모달에 그룹 검색 + 게스트 라디오 + 이메일 필드 추가
> - `now-book-submit.ts`에 그룹 확장 + 게스트 이메일 파싱 + capacity 자동 계산
> - `guest-select.ts`가 두 모달(book_modal, now_book_end_time) 모두 처리
> - 대화형 예약에서 참석자 기반 자동 인원 계산
> - `/신고` 커맨드 + Setup Panel 버튼 + DM/멘션 키워드 → 신고 모달 → 관리자 DM 알림
> 
> **Estimated Effort**: Medium (8 tasks + 1 verification)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: T1 → T2/T3 → T8(build) | T5 → T7 → T8

---

## Context

### Original Request
1. `/즉시예약` 모달 참석자 필드가 `/예약`과 불일치 → 일관성 확보
2. 대화형 예약에서 인원수 질문 대신 참석자를 물어보고 자동 계산
3. 신고/건의사항 기능: 사용자가 불편사항을 신고하면 관리자에게 DM 알림

### Interview Summary
**Key Discussions**:
- `/즉시예약` 모달: `min_query_length: 3`, 그룹/게스트 미지원 → `/예약`과 동일하게
- 대화형: `buildInfoPrompt()`가 "몇 명이 사용하시나요?" → 참석자 기반으로 전환
- 신고: `/신고` 커맨드 + Setup Panel 버튼 + DM/멘션 키워드 대응
- 신고 유형: 건의사항 / 불편사항 / 기타 (라디오)
- 관리자: `ADMIN_SLACK_USER_ID` 환경변수
- 신고자에게 DM으로 접수 확인

**Research Findings**:
- `attendee-options.ts`는 `group:XXXXX` 접두어로 그룹 구분
- `book-submit.ts` L116-149에 그룹 확장 로직 (재사용 가능)
- DM/멘션 이벤트에는 `trigger_id` 없음 → 모달 직접 열기 불가 → `/신고` 안내 텍스트 전송
- 기존 패턴: `registerXxxCommand(app)`, `registerXxxSubmit(app)`, `registerXxxActions(app)`

### Metis Review
**Identified Gaps** (addressed):
- **그룹 확장 로직 누락**: `now-book-submit.ts`에서 `group:` 값 직접 매핑 → 그룹 확장 필수
- **guest-select 브랜칭**: 두 모달 `private_metadata` 구조 다름 → `callback_id` 분기
- **capacity vs attendees 충돌**: 참석자 수 + 1이 항상 우선
- **DM trigger_id 제약**: 메시지 이벤트에서 모달 열기 불가 → `/신고` 안내 텍스트
- **ADMIN 미설정 시**: 그레이스풀 처리 (로그 경고, 리포터 확인은 정상 전송)
- **message-parser.ts 수정 금지**: 신고 키워드는 dm.ts/mention.ts에서 인라인 처리

---

## Work Objectives

### Core Objective
(A) 모달 일관성, (B) 대화형 참석자 자동계산, (C) 신고/건의 기능 신규 추가

### Concrete Deliverables
- `result-views.ts`: `buildEndTimeModal`에 그룹검색 + 게스트 필드
- `now-book-submit.ts`: 그룹 확장 + 게스트 파싱 + capacity 자동계산
- `guest-select.ts`: callback_id 기반 듀얼 모달 지원
- `conversation.ts`: 참석자 기반 대화형 흐름
- `src/views/report-modal.ts` (신규): 신고 모달 빌더
- `src/listeners/commands/report.ts` (신규): `/신고` 커맨드
- `src/listeners/views/report-submit.ts` (신규): 신고 제출 핸들러
- 7개 기존 파일 수정 (env, setup-panel, dm, mention, commands/index, views/index, .env.example)

### Definition of Done
- [ ] `npx tsc --noEmit` 통과
- [ ] `/즉시예약` 모달에서 그룹 검색 + 게스트 지원
- [ ] 대화형 예약에서 참석자 기반 자동 인원 계산
- [ ] `/신고` 커맨드로 신고 모달 열림
- [ ] Setup Panel에 신고 버튼 표시
- [ ] 신고 제출 시 관리자 DM + 신고자 확인 DM

### Must Have
- `/예약`과 `/즉시예약` 참석자 필드 완전 일치
- 게스트 이메일 → Google Calendar 초대장 발송
- 대화형에서 참석자 미입력 시 재요청 (또는 "없음/혼자" 허용)
- 신고 유형: 건의사항 / 불편사항 / 기타
- 신고 상세내용 필수 (min_length: 1, max_length: 2000)
- ADMIN 미설정 시 그레이스풀 처리 (리포터 확인은 항상 전송)

### Must NOT Have (Guardrails)
- Google Calendar ID 변경 금지
- `book-modal.ts`, `attendee-options.ts`, `message-parser.ts` 변경 금지
- 대화형에서 게스트 기능 추가 금지 (모달 전용)
- `src/types/index.ts`에 신고 관련 타입 추가 금지
- 신고 저장/이력/상태 추적 금지 (fire-and-forget)
- 복수 관리자 지원 금지
- 익명 신고 금지
- 기존 Setup Panel 자동 업데이트 금지 (재설치 필요)
- 신고 모달에 `dispatch_action` 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: none

### QA Policy
Every task includes agent-executed QA scenarios.
- **TypeScript 빌드**: `npx tsc --noEmit`
- **코드 리뷰**: 파일 읽어서 패턴 일관성 비교

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 독립 작업, 4개 병렬):
├── Task 1: buildEndTimeModal 그룹검색 + 게스트 필드 [quick]
├── Task 4: conversation.ts 대화형 흐름 개선 [quick]
├── Task 5: report-modal.ts + env.ts + .env.example (신고 기반) [quick]
└── Task 6: report.ts 커맨드 + report-submit.ts 제출 핸들러 [quick]

Wave 2 (After Wave 1 — 의존 작업, 4개 병렬):
├── Task 2: now-book-submit.ts 그룹 확장 + 게스트 (depends: T1) [quick]
├── Task 3: guest-select.ts 듀얼 모달 지원 (depends: T1) [quick]
├── Task 7: setup-panel + dm + mention + index 등록 (depends: T5, T6) [quick]
└── (T4 독립 완료 후 합류)

Wave 3 (After ALL — 검증):
└── Task 8: TypeScript 빌드 + 전체 코드 일관성 리뷰 [quick]

Critical Path: T1 → T2/T3 → T8 | T5 → T7 → T8
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| 1 | — | 2, 3 |
| 2 | 1 | 8 |
| 3 | 1 | 8 |
| 4 | — | 8 |
| 5 | — | 7 |
| 6 | — | 7 |
| 7 | 5, 6 | 8 |
| 8 | 2, 3, 4, 7 | — |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks — T1,T4,T5,T6 → all `quick`
- **Wave 2**: 3 tasks — T2,T3,T7 → all `quick`
- **Wave 3**: 1 task — T8 → `quick`

---

## TODOs

- [ ] 1. buildEndTimeModal 그룹검색 + 게스트 필드 추가

  **What to do**:
  - `result-views.ts`에 `EndTimeModalOptions` 인터페이스 추가 (export)
  - `buildEndTimeModal` 4번째 파라미터 `options: EndTimeModalOptions = {}` 추가
  - 참석자 블록: `min_query_length: 0`, label `'👥 참석자 / 그룹'`, placeholder `'이름 또는 그룹명으로 검색'`
  - 게스트 라디오 블록 추가: `action_id: 'guest_select'`, `dispatch_action: true`
  - 게스트 이메일 블록 조건부: `...(options.showGuestEmails ? [...] : [])`
  - duration/title에 initialValues 지원 추가
  - `book-modal.ts:90-138`의 참석자/게스트 블록 구조 그대로 복사

  **Must NOT do**: `book-modal.ts`, `attendee-options.ts` 변경 금지. 기존 파라미터 순서 변경 금지.

  **Recommended Agent Profile**: `quick` | Skills: []

  **Parallelization**: Wave 1 | Blocks: T2, T3 | Blocked By: None

  **References**:
  - `src/views/book-modal.ts:4-16` — BookModalOptions 구조 (복사 대상)
  - `src/views/book-modal.ts:90-138` — 참석자+게스트 블록 전체 (복사 대상)
  - `src/views/result-views.ts:124-230` — buildEndTimeModal 전체 (수정 대상)

  **Acceptance Criteria**:
  - [ ] EndTimeModalOptions export됨
  - [ ] 참석자 `min_query_length: 0`, 게스트 라디오+이메일 블록 존재
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 모달 구조 일관성
    Tool: Read + Grep
    Steps: result-views.ts에서 min_query_length=0, guest_radio_block, guest_emails_block 확인
    Expected: /예약 모달과 동일한 구조
    Evidence: .sisyphus/evidence/task-1-modal-consistency.txt
  ```
  **Commit**: YES (groups all) | Files: `src/views/result-views.ts`

- [ ] 2. now-book-submit.ts 그룹 확장 + 게스트 파싱 + capacity 자동 계산

  **What to do**:
  - 참석자 매핑 변경: `group:XXXXX` 접두어 감지 → `usergroups.users.list` + `users.info`로 확장 (`book-submit.ts:116-149` 패턴)
  - 게스트 이메일 파싱: `guest_emails_block`에서 쉼표/줄바꿈 분리, regex 검증 (`/.+@.+\..+/`)
  - capacity 자동 계산: attendees.length + 1, organizer 중복 제외

  **Must NOT do**: `book-submit.ts` 변경 금지.

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 2 | Blocks: T8 | Blocked By: T1

  **References**:
  - `src/listeners/views/book-submit.ts:116-149` — 그룹 확장 패턴 (복사 대상)
  - `src/listeners/views/book-submit.ts:151-175` — 게스트 파싱 + capacity 계산 (복사 대상)
  - `src/listeners/views/now-book-submit.ts:56-80` — 수정 대상

  **Acceptance Criteria**:
  - [ ] `group:` 접두어 → usergroups.users.list 호출
  - [ ] guest_emails_block 읽기 + attendees 통합
  - [ ] organizer 중복 제외
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 그룹 확장 + 게스트 파싱 존재 확인
    Tool: Read + Grep
    Steps: now-book-submit.ts에서 'usergroups.users.list', 'guest_emails_block', organizer 필터 확인
    Evidence: .sisyphus/evidence/task-2-group-guest.txt
  ```
  **Commit**: YES (groups all) | Files: `src/listeners/views/now-book-submit.ts`

- [ ] 3. guest-select.ts 듀얼 모달 지원

  **What to do**:
  - `callback_id` 기반 분기 추가: `now_book_end_time` → `buildEndTimeModal`, 기존 → `buildBookModal`
  - `/즉시예약` 분기: `private_metadata`에서 `{bookingId, roomId}` 추출, `getRoomById(roomId)` 사용
  - `availableUntil: null` 전달 (즉시예약이라 의미 없음)
  - 현재 폼 값 읽기: duration, title, attendees, guestEmails
  - import 추가: `buildEndTimeModal` from result-views, `getRoomById` from rooms

  **Must NOT do**: 기존 `/예약` 모달 코드 변경 금지.

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 2 | Blocks: T8 | Blocked By: T1

  **References**:
  - `src/listeners/actions/guest-select.ts:1-67` — 전체 코드 (수정 대상)
  - `src/views/result-views.ts` — buildEndTimeModal, EndTimeModalOptions (T1에서 생성)
  - `src/config/rooms.ts` — getRoomById(roomId)

  **Acceptance Criteria**:
  - [ ] `now_book_end_time` 분기 존재
  - [ ] `buildEndTimeModal` + `getRoomById` import 및 사용
  - [ ] 기존 else 분기 변경 없음
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 듀얼 모달 분기 확인
    Tool: Read
    Steps: guest-select.ts에서 'now_book_end_time', 'buildEndTimeModal', 'getRoomById' 확인
    Evidence: .sisyphus/evidence/task-3-dual-modal.txt
  ```
  **Commit**: YES (groups all) | Files: `src/listeners/actions/guest-select.ts`

- [ ] 4. conversation.ts 대화형 흐름 개선

  **What to do**:
  - `buildInfoPrompt()` 변경: '참석자 이름을 알려주세요. (본인 제외)\n예: 홍길동, 김철수\n참석자가 없으면 "없음" 또는 "혼자"라고 입력하세요.'
  - `waiting_info` 케이스 변경:
    - '없음'/'혼자'/'나만'/'나 혼자' 처리 → capacity=1, attendees=[], stage='waiting_title'
    - 참석자 있으면 capacity = attendees.length + 1 (항상 우선)
    - 숫자만 입력("3명") + 참석자 이름 없음 → 재요청
    - 아무 정보 없음 → 재요청

  **Must NOT do**: `parseCapacity`, `parseAttendeeNames` 함수 변경 금지. `message-parser.ts` 변경 금지. 다른 stage 변경 금지.

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 1 | Blocks: T8 | Blocked By: None

  **References**:
  - `src/services/conversation.ts:68-70` — buildInfoPrompt (수정 대상)
  - `src/services/conversation.ts:140-177` — waiting_info 케이스 (수정 대상)
  - `src/services/message-parser.ts:38-41` — parseCapacity 시그니처 (호출 유지, 우선순위 변경)

  **Acceptance Criteria**:
  - [ ] buildInfoPrompt에 '참석자' 포함, '몇 명' 미포함
  - [ ] '없음'/'혼자' → capacity=1
  - [ ] 참석자 있으면 capacity = attendees.length + 1
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 프롬프트 + 없음/혼자 + 자동계산 확인
    Tool: Read + Grep
    Steps: conversation.ts에서 buildInfoPrompt 반환값, '없음'/'혼자' 처리, capacity 계산 확인
    Evidence: .sisyphus/evidence/task-4-conversation.txt
  ```
  **Commit**: YES (groups all) | Files: `src/services/conversation.ts`

- [ ] 5. 신고 모달 빌더 + 환경변수 설정

  **What to do**:
  - **새 파일** `src/views/report-modal.ts` 생성:
    - `buildReportModal()` 함수 export
    - 모달 구조: `callback_id: 'report_modal'`, title: '신고/건의'
    - 신고 유형 라디오 (radio_buttons): 건의사항 / 불편사항 / 기타
      - block_id: 'report_type_block', action_id: 'report_type_input'
      - `initial_option` 없음 (명시적 선택 강제)
      - 필수 필드 (optional: false 기본값)
    - 상세내용 (plain_text_input, multiline):
      - block_id: 'report_content_block', action_id: 'report_content_input'
      - `min_length: 1`, `max_length: 2000`
      - placeholder: '상세한 내용을 입력해주세요'
    - submit: '제출', close: '취소'
    - `as const` 타입 리터럴 사용 (`book-modal.ts` 패턴)
    - `dispatch_action` 사용 금지 (정적 모달)
  - `src/config/env.ts` 수정: `admin: { slackUserId: process.env['ADMIN_SLACK_USER_ID'] }` 추가
  - `.env.example` 수정: `# Admin (optional)\nADMIN_SLACK_USER_ID=U012345ADMIN` 추가

  **Must NOT do**: `src/types/index.ts` 변경 금지. 신고 저장/이력 기능 금지.

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 1 | Blocks: T7 | Blocked By: None

  **References**:
  - `src/views/book-modal.ts:18-141` — 모달 빌더 패턴 (참조)
  - `src/config/env.ts:23-38` — env 객체 구조 (수정 대상)
  - `.env.example` — 환경변수 문서 (수정 대상)

  **Acceptance Criteria**:
  - [ ] `src/views/report-modal.ts` 존재, `buildReportModal` export
  - [ ] 라디오: 3개 옵션 (건의사항/불편사항/기타)
  - [ ] 상세내용: multiline, min_length:1, max_length:2000
  - [ ] env.ts에 `admin.slackUserId` 존재
  - [ ] .env.example에 ADMIN_SLACK_USER_ID 존재
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 신고 모달 구조 확인
    Tool: Read
    Steps: report-modal.ts 읽기, callback_id='report_modal', 라디오 3개, multiline input 확인
    Evidence: .sisyphus/evidence/task-5-report-modal.txt
  ```
  **Commit**: YES (groups all) | Files: `src/views/report-modal.ts`, `src/config/env.ts`, `.env.example`

- [ ] 6. /신고 커맨드 + 신고 제출 핸들러

  **What to do**:
  - **새 파일** `src/listeners/commands/report.ts` 생성:
    - `registerReportCommand(app: App)` export
    - `app.command('/신고', async ({ ack, body, client, logger }) => { ... })`
    - `trigger_id`로 `buildReportModal()` 열기
    - `book.ts` 패턴 그대로 따르기
  - **새 파일** `src/listeners/views/report-submit.ts` 생성:
    - `registerReportSubmit(app: App)` export
    - `app.view('report_modal', async ({ ack, view, body, client, logger }) => { ... })`
    - `ack({ response_action: 'clear' })`
    - 신고 유형: `view.state.values['report_type_block']?.['report_type_input']?.selected_option?.value`
    - 상세내용: `view.state.values['report_content_block']?.['report_content_input']?.value`
    - 신고자 ID: `body.user.id`, 신고자 이름: `body.user.name`
    - **관리자 DM**: `env.admin.slackUserId`가 있으면:
      ```
      client.chat.postMessage({
        channel: adminUserId,
        text: `📢 *새 신고/건의가 접수되었습니다*\n*신고자:* <@${userId}>\n*유형:* ${typeLabel}\n*내용:*\n${content}\n*시간:* ${new Date().toLocaleString('ko-KR')}`
      })
      ```
    - **ADMIN 미설정**: `env.admin.slackUserId`가 없으면 관리자 DM 스킵, 로그 경고만
    - **신고자 확인 DM**: 항상 전송
      ```
      client.chat.postMessage({
        channel: userId,
        text: `✅ 신고/건의가 접수되었습니다.\n*유형:* ${typeLabel}\n감사합니다. 불편사항은 빠르게 개선하겠습니다.`
      })
      ```
    - 에러 처리: 관리자 DM 실패 시 catch로 무시, 신고자 DM은 항상 시도

  **Must NOT do**: 신고 저장/이력 금지. 복수 관리자 금지.

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 1 | Blocks: T7 | Blocked By: None

  **References**:
  - `src/listeners/commands/book.ts` — 커맨드 핸들러 패턴
  - `src/listeners/views/book-submit.ts:15-228` — view submission 패턴
  - `src/config/env.ts` — env.admin.slackUserId (T5에서 생성)
  - `src/views/report-modal.ts` — buildReportModal (T5에서 생성)

  **Acceptance Criteria**:
  - [ ] `/신고` 커맨드 핸들러 존재, buildReportModal 호출
  - [ ] report-submit에서 신고유형 + 상세내용 파싱
  - [ ] 관리자 DM + 신고자 확인 DM 코드 존재
  - [ ] ADMIN 미설정 시 그레이스풀 처리
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 커맨드 + 제출 핸들러 구조 확인
    Tool: Read + Grep
    Steps:
      1. report.ts에서 app.command('/신고') 확인
      2. report-submit.ts에서 app.view('report_modal') 확인
      3. 'ADMIN_SLACK_USER_ID' 또는 'admin.slackUserId' 사용 확인
      4. 신고자 DM 코드 확인
    Evidence: .sisyphus/evidence/task-6-report-handlers.txt
  ```
  **Commit**: YES (groups all) | Files: `src/listeners/commands/report.ts`, `src/listeners/views/report-submit.ts`

- [ ] 7. Setup Panel + DM + 멘션 + index 등록 통합

  **What to do**:
  - `src/views/setup-panel-message.ts` 수정:
    - actions elements에 3번째 버튼 추가: `{ type: 'button', text: '📢 신고/건의', action_id: 'open_report_modal' }`
  - `src/listeners/actions/setup-panel.ts` 수정:
    - `app.action('open_report_modal', ...)` 핸들러 추가 (`open_book_modal` 패턴 복사)
    - import `buildReportModal` from `../../views/report-modal.js`
  - `src/listeners/commands/index.ts` 수정:
    - import + call `registerReportCommand`
  - `src/listeners/views/index.ts` 수정:
    - import + call `registerReportSubmit`
  - `src/listeners/events/dm.ts` 수정:
    - 기존 대화 체크(L48) 후, `parseMessageIntent`(L51) 전에 신고 키워드 감지 삽입
    - 키워드: '신고', '건의', '불편'
    - 응답: '신고/건의를 접수하려면 `/신고` 커맨드를 사용해주세요.'
  - `src/listeners/events/mention.ts` 수정:
    - 동일한 키워드 감지 삽입 (대화 체크 후, parseMessageIntent 전)
    - ephemeral 메시지로 '/신고' 안내

  **Must NOT do**: `message-parser.ts` 변경 금지. 기존 패널 자동 업데이트 금지 (재설치 필요).

  **Recommended Agent Profile**: `quick` | Skills: []
  **Parallelization**: Wave 2 | Blocks: T8 | Blocked By: T5, T6

  **References**:
  - `src/views/setup-panel-message.ts:1-38` — 전체 코드 (수정 대상)
  - `src/listeners/actions/setup-panel.ts:7-22` — open_book_modal 패턴 (복사 대상)
  - `src/listeners/commands/index.ts:1-12` — 등록 패턴 (수정 대상)
  - `src/listeners/views/index.ts:1-10` — 등록 패턴 (수정 대상)
  - `src/listeners/events/dm.ts:48-51` — 신고 키워드 삽입 위치
  - `src/listeners/events/mention.ts:56-58` — 신고 키워드 삽입 위치

  **Acceptance Criteria**:
  - [ ] setup-panel에 open_report_modal 버튼 존재
  - [ ] setup-panel.ts에 open_report_modal 핸들러 존재
  - [ ] commands/index.ts에 registerReportCommand 호출 존재
  - [ ] views/index.ts에 registerReportSubmit 호출 존재
  - [ ] dm.ts에 '신고'/'건의'/'불편' 키워드 감지 존재
  - [ ] mention.ts에 키워드 감지 존재
  - [ ] `npx tsc --noEmit` 통과

  **QA Scenarios:**
  ```
  Scenario: 통합 등록 확인
    Tool: Read + Grep
    Steps:
      1. setup-panel-message.ts에서 'open_report_modal' 확인
      2. setup-panel.ts에서 'open_report_modal' 핸들러 확인
      3. commands/index.ts에서 'registerReportCommand' 확인
      4. views/index.ts에서 'registerReportSubmit' 확인
      5. dm.ts에서 '신고' 키워드 확인
      6. mention.ts에서 '신고' 키워드 확인
    Evidence: .sisyphus/evidence/task-7-integration.txt
  ```
  **Commit**: YES (groups all) | Files: setup-panel-message.ts, setup-panel.ts, commands/index.ts, views/index.ts, dm.ts, mention.ts

---

## Final Verification Wave

- [ ] 8. **TypeScript 빌드 + 전체 코드 일관성 리뷰** — `quick`
  
  **What to do**:
  - `npx tsc --noEmit` 실행하여 타입 에러 없음 확인
  - 변경/생성된 모든 파일을 읽어서 검증:
    (a) `/즉시예약` 모달의 참석자/게스트 블록이 `/예약` 모달과 동일한 구조인지 비교
    (b) `now-book-submit.ts`의 그룹 확장 로직이 `book-submit.ts`와 동일한 패턴인지
    (c) `guest-select.ts`의 두 모달 분기가 올바른지
    (d) `conversation.ts`의 대화 흐름이 자연스러운지
    (e) `report-modal.ts`가 기존 모달 빌더 패턴 (`book-modal.ts`) 을 따르는지
    (f) `report-submit.ts`가 기존 submit 패턴을 따르는지
    (g) 모든 index.ts 등록이 누락 없는지
    (h) `.env.example`에 `ADMIN_SLACK_USER_ID` 있는지
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Blocked By**: Task 2, 3, 4, 7

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` → 에러 0개
  - [ ] 모든 파일 패턴 일관성 확인

  **QA Scenarios:**
  ```
  Scenario: TypeScript 빌드 통과
    Tool: Bash
    Steps:
      1. `npx tsc --noEmit` 실행
    Expected Result: exit code 0, 에러 출력 없음
    Evidence: .sisyphus/evidence/task-8-build.txt

  Scenario: 전체 코드 일관성 리뷰
    Tool: Read + Grep
    Steps:
      1. result-views.ts에서 min_query_length 값 확인 → 0
      2. result-views.ts에서 guest_radio_block 존재 확인
      3. now-book-submit.ts에서 'usergroups.users.list' 호출 확인
      4. guest-select.ts에서 'now_book_end_time' 분기 확인
      5. conversation.ts에서 buildInfoPrompt 반환값에 '참석자' 포함 확인
      6. report-modal.ts 존재 및 buildReportModal export 확인
      7. report-submit.ts에서 ADMIN_SLACK_USER_ID 사용 확인
      8. setup-panel-message.ts에서 open_report_modal 버튼 확인
      9. commands/index.ts에서 registerReportCommand 호출 확인
      10. views/index.ts에서 registerReportSubmit 호출 확인
      11. .env.example에서 ADMIN_SLACK_USER_ID 존재 확인
    Expected Result: 모든 항목 통과
    Evidence: .sisyphus/evidence/task-8-consistency.txt
  ```

  **Commit**: YES
  - Message: `feat: UX 개선 + 신고/건의 기능 추가`
  - Files: 모든 변경/생성 파일
  - Pre-commit: `npx tsc --noEmit`

---

## Commit Strategy

- **1**: `feat: 즉시예약 모달 일관성 + 대화형 개선 + 신고/건의 기능` — 전체 파일

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit  # Expected: no errors
```

### Final Checklist
- [ ] `/즉시예약` 모달에 그룹 검색 + 게스트 라디오 + 이메일 필드 있음
- [ ] `/즉시예약` 제출 시 그룹 멤버 확장됨
- [ ] `/즉시예약` 제출 시 게스트 이메일이 attendees에 포함됨
- [ ] 게스트 라디오 토글 시 `/즉시예약` 모달도 정상 업데이트
- [ ] 대화형 예약에서 참석자를 물어봄
- [ ] 대화형에서 capacity = attendees.length + 1 자동 계산
- [ ] `/신고` 커맨드로 신고 모달 열림
- [ ] Setup Panel에 📢 신고/건의 버튼 있음
- [ ] 신고 제출 시 관리자 DM 수신
- [ ] 신고 제출 시 신고자 확인 DM 수신
- [ ] DM에서 "신고" 키워드 시 `/신고` 안내
- [ ] ADMIN 미설정 시 앱 크래시 없음
- [ ] `npx tsc --noEmit` 통과
