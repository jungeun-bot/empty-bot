# Edit/Cancel Flow 버그 수정 (7건)

## TL;DR

> **Quick Summary**: 수정/취소 시 "예약이 없습니다" 오류의 근본 원인(`privateExtendedProperty` 필터)과 감사에서 발견된 6개 추가 버그를 수정. 3개 파일, ~30줄 변경.
> 
> **Deliverables**:
> - `calendar.ts` — privateExtendedProperty 필터 제거
> - `edit-submit.ts` — 5개 버그 수정 (이메일 에러핸들링, 대소문자, 로깅, 타임존, 유효성 검사)
> - `edit-modal.ts` — Slack 75자 제한 처리
> - 빌드 통과 + 배포
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 + Task 3 (coupled) → Task 4 (build + deploy)

---

## Context

### Original Request
사용자가 예약 수정/취소 시 날짜를 선택하면 "해당 날짜에 수정 가능한 예약이 없습니다" 메시지가 나타남. 실제로는 여러 예약이 존재하는 상태.

### Interview Summary
**Key Discussions**:
- Librarian 연구: Google Calendar API `privateExtendedProperty`는 `(calendarId, eventId)` 복사본에만 존재. Room 캘린더 복사본으로 전파 안 됨.
- 4개 explore 에이전트로 전체 파일 감사 → 37개 이슈 보고 → 교차 검증으로 7개 실제 버그 확인, 나머지 오탐
- 사용자: 7건 전체 수정 선택

**Research Findings**:
- Google Calendar API 공식 문서: "private properties are specific to the calendarId and eventId used in the request"
- `e.organizer?.email`은 room 캘린더 복사본에서도 원래 이벤트 생성자(impersonated user) 이메일 반환
- 서비스 계정의 room 캘린더 권한은 기존에 동작 확인됨 (리팩토링 전 수정/취소 성공)

### Metis Review
**Identified Gaps** (addressed):
- Bug #1 + #3 결합 관계: 필터 제거 후 이메일 비교가 유일한 소유권 검증 → 함께 수정 필수
- 스코프 크립 방지: `sharedExtendedProperty` 전환 금지, `createBooking` 수정 금지
- Bug #5 문자 수 계산: 제목 앞 ~58자 사용 → 17자만 남음 → 절단 필요
- 빌드 베이스라인 확인: `npx tsc --noEmit` 통과

---

## Work Objectives

### Core Objective
수정/취소 플로우의 7개 확인된 버그를 수정하여 예약 조회/수정/취소가 정상 동작하도록 함.

### Concrete Deliverables
- `src/services/calendar.ts` — 1줄 삭제 (privateExtendedProperty 필터)
- `src/listeners/views/edit-submit.ts` — 5개 수정 (빈 catch, toLowerCase, 로깅, +09:00, 유효성 검사)
- `src/views/edit-modal.ts` — 옵션 텍스트 75자 절단
- 빌드 성공 + GitHub 푸시 + Render 배포

### Definition of Done
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → dist/ 생성 성공
- [ ] `privateExtendedProperty` 검색 → calendar.ts에서 0 match
- [ ] `'T00:00:00'` without `+09:00` 검색 → edit-submit.ts에서 0 match
- [ ] `.toLowerCase()` 검색 → organizer 비교 근처에 존재

### Must Have
- Bug #1: `listRoomEvents`에서 `privateExtendedProperty` 필터 완전 제거
- Bug #2: `client.users.info()` 실패 시 에러 로깅 + 사용자에게 오류 모달 표시
- Bug #3: `b.organizer === organizerEmail` → 양쪽 `.toLowerCase()` 적용
- Bug #4: `Promise.allSettled` rejected 결과에 `logger.warn` 추가
- Bug #5: 옵션 텍스트 75자 이내로 절단 (말줄임 포함)
- Bug #6: 4개 `new Date(dateStr + 'T00:00:00')` → `new Date(dateStr + 'T00:00:00+09:00')`
- Bug #7: `updateBooking`/`cancelBooking` 호출 전 booking 존재 확인 + 없으면 에러 반환

### Must NOT Have (Guardrails)
- `createBooking()` 수정 금지 (`calendar.ts:58-167`) — sharedExtendedProperty 전환 금지
- `updateBooking()`, `cancelBooking()` 내부 로직 수정 금지 — Bug #7은 호출자(edit-submit.ts)에서 수정
- `conversation.ts` 수정 금지
- `buildEditBookingModal()`, `buildCancelConfirmModal()` 함수 시그니처 변경 금지
- callback_id 변경 금지
- `edit-modal.ts:86` value 형식 (`roomId::eventId`) 변경 금지
- `google-auth.ts`, `rooms.ts`, `env.ts`, `notification.ts` 수정 금지
- 새로운 npm 의존성 추가 금지
- 날짜 처리 유틸리티 함수 추출/리팩토링 금지 — 4개 라인에 `+09:00`만 추가
- Bug #5: 옵션 텍스트 포맷 재설계 금지 — 절단만 적용

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (테스트 프레임워크 없음)
- **Automated tests**: None
- **Framework**: N/A

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Code verification**: Bash (grep, tsc) — 패턴 검색, 빌드 확인
- **Build verification**: Bash (npm run build) — dist/ 생성 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 3 parallel tasks):
├── Task 1: calendar.ts — Bug #1 제거 [quick]
├── Task 2: edit-modal.ts — Bug #5 75자 절단 [quick]
└── Task 3: edit-submit.ts — Bugs #2,#3,#4,#6,#7 [quick]

Wave 2 (After Wave 1 — build + deploy):
└── Task 4: 빌드 검증 + 배포 [quick]

Wave FINAL (After ALL — 4 parallel):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real QA — grep assertions [unspecified-high]
└── F4: Scope fidelity check [deep]

Critical Path: Task 1+3 (coupled) → Task 4 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 | — | T4 |
| T2 | — | T4 |
| T3 | — | T4 |
| T4 | T1, T2, T3 | F1-F4 |
| F1-F4 | T4 | — |

### Agent Dispatch Summary

- **Wave 1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2**: **1** — T4 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. [calendar.ts] privateExtendedProperty 필터 제거 (Bug #1)

  **What to do**:
  - `src/services/calendar.ts` 라인 238에서 `privateExtendedProperty: ['createdBy=slack-room-bot'],` 줄을 완전히 삭제
  - 다른 코드는 절대 수정하지 않음
  - 삭제 후 `npx tsc --noEmit` 실행하여 빌드 확인

  **Must NOT do**:
  - `createBooking()`의 `extendedProperties.private` 설정을 `shared`로 변경하지 않음
  - `listRoomEvents`에 대체 필터를 추가하지 않음 — downstream organizer 비교(Task 3에서 수정)가 소유권 검증
  - 이 파일의 다른 함수(`getAvailableRooms`, `createBooking`, `updateBooking`, `cancelBooking`, `getRoomAvailableUntil`, `getKSTDayRange`) 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 라인 삭제 — 가장 간단한 수정
  - **Skills**: []
    - 추가 스킬 불필요
  - **Skills Evaluated but Omitted**:
    - `playwright`: UI 관련 아님
    - `git-master`: 커밋 단계 아님

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/services/calendar.ts:227-254` — `listRoomEvents` 함수 전체. 라인 238이 삭제 대상. 라인 232-239의 `events.list` 호출에서 `privateExtendedProperty` 파라미터만 제거.

  **API/Type References**:
  - Google Calendar API Events.list: `privateExtendedProperty`는 선택적 필터 파라미터. 제거해도 API 호출 형식에 영향 없음.

  **WHY Each Reference Matters**:
  - `calendar.ts:238` — 이 줄이 정확한 삭제 대상. room 캘린더 복사본에는 private extended property가 없어서 항상 0건 반환됨.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: privateExtendedProperty 필터 라인이 제거되었는지 확인
    Tool: Bash (grep)
    Preconditions: calendar.ts 수정 완료
    Steps:
      1. grep -n "privateExtendedProperty" src/services/calendar.ts
      2. 결과가 0줄인지 확인
    Expected Result: 출력 없음 (0 matches)
    Failure Indicators: "privateExtendedProperty" 문자열이 여전히 존재
    Evidence: .sisyphus/evidence/task-1-filter-removed.txt

  Scenario: TypeScript 빌드 성공 확인
    Tool: Bash
    Preconditions: calendar.ts 수정 완료
    Steps:
      1. npx tsc --noEmit
      2. exit code가 0인지 확인
    Expected Result: 출력 없음, exit code 0
    Failure Indicators: 컴파일 에러 메시지 출력
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt

  Scenario: listRoomEvents 함수 구조가 올바른지 확인
    Tool: Bash (grep)
    Preconditions: calendar.ts 수정 완료
    Steps:
      1. grep -A5 "events.list" src/services/calendar.ts
      2. calendarId, timeMin, timeMax, singleEvents, orderBy가 존재하고 privateExtendedProperty가 없는지 확인
    Expected Result: events.list 호출에 5개 파라미터만 존재 (privateExtendedProperty 없음)
    Failure Indicators: privateExtendedProperty가 여전히 존재하거나 다른 파라미터가 누락됨
    Evidence: .sisyphus/evidence/task-1-events-list-params.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3)
  - Message: `fix(calendar): remove broken privateExtendedProperty filter from listRoomEvents`
  - Files: `src/services/calendar.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 2. [edit-modal.ts] 옵션 텍스트 75자 절단 (Bug #5)

  **What to do**:
  - `src/views/edit-modal.ts`의 `buildBookingListModal()` 함수에서 라디오 옵션 텍스트가 Slack의 75자 제한을 초과하지 않도록 절단 처리
  - 현재 포맷: `` `[${b.roomName}] ${formatDateTime(b.startTime)} ~ ${formatDateTime(b.endTime)} | ${b.summary}` ``
  - 시간 정보는 유지하고, `summary` 부분만 남는 글자 수에 맞춰 절단 + `…` 추가
  - 구현 방식: 전체 텍스트를 조합한 후 75자 초과 시 72자 + `...` 로 절단
  - `npx tsc --noEmit` 실행하여 빌드 확인

  **Must NOT do**:
  - 옵션 텍스트 포맷 자체를 재설계하지 않음 (시간 범위, 룸 이름 표시 방식 유지)
  - `roomId::eventId` value 형식 변경 금지
  - `buildEditBookingModal()`, `buildCancelConfirmModal()` 수정 금지
  - 이 파일의 다른 함수 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 텍스트 절단 로직 1줄 추가
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Slack Block Kit 텍스트, UI 프레임워크 아님

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/views/edit-modal.ts:81-146` — `buildBookingListModal()` 함수 전체. 라인 ~85에서 옵션 텍스트 생성.
  - `src/views/edit-modal.ts:86` — `value: \`\${b.roomId}::\${b.eventId}\`` — 이 value는 변경하지 않음

  **External References**:
  - Slack Block Kit: radio_buttons 옵션의 text.text 필드는 plain_text 75자 제한

  **WHY Each Reference Matters**:
  - `edit-modal.ts:81-146` — 옵션 텍스트가 생성되는 정확한 위치. `formatDateTime` 출력(~16자) × 2 + 룸 이름(~15자) + 구분자들 = ~58자. summary에 17자만 남음.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 긴 제목의 예약이 75자 이내로 절단되는지 확인
    Tool: Bash (grep)
    Preconditions: edit-modal.ts 수정 완료
    Steps:
      1. grep -n "slice\|substring\|75" src/views/edit-modal.ts
      2. buildBookingListModal 함수 내에 75자 절단 로직이 존재하는지 확인
    Expected Result: 절단 관련 코드가 존재함
    Failure Indicators: 절단 로직 없음
    Evidence: .sisyphus/evidence/task-2-truncation-check.txt

  Scenario: TypeScript 빌드 성공 확인
    Tool: Bash
    Preconditions: edit-modal.ts 수정 완료
    Steps:
      1. npx tsc --noEmit
    Expected Result: exit code 0, 출력 없음
    Failure Indicators: 컴파일 에러
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt
  ```

  **Commit**: YES (groups with Tasks 1, 3)
  - Message: `fix(edit-modal): truncate booking option text to Slack 75-char limit`
  - Files: `src/views/edit-modal.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 3. [edit-submit.ts] 5개 버그 수정 — Bugs #2, #3, #4, #6, #7

  **What to do**:

  **Bug #3 (CRITICAL — Bug #1과 결합)**: 라인 58
  - `b.organizer === organizerEmail` → `b.organizer.toLowerCase() === organizerEmail.toLowerCase()`
  - Bug #1에서 필터 제거 후, 이 비교가 유일한 소유권 검증이므로 반드시 수정

  **Bug #2 (CRITICAL)**: 라인 32-38
  - 빈 catch 블록에 에러 처리 추가:
    ```typescript
    } catch (emailError) {
      logger.error('사용자 이메일 조회 실패:', emailError);
      await client.views.update({
        view_id: body.view?.id ?? '',
        view: buildErrorView('⚠️ 사용자 정보를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.'),
      });
      return;
    }
    ```

  **Bug #4 (MEDIUM)**: 라인 45-55
  - `Promise.allSettled` 루프에서 rejected 결과 로깅 추가:
    ```typescript
    if (result.status === 'fulfilled') {
      // ... existing code ...
    } else {
      logger.warn(`회의실 ${ROOMS[i]!.name} 예약 조회 실패:`, result.reason);
    }
    ```

  **Bug #6 (LOW)**: 라인 40, 110, 170, 229
  - 4개 위치 모두: `new Date(dateStr + 'T00:00:00')` → `new Date(dateStr + 'T00:00:00+09:00')`
  - 정확한 위치:
    - Handler 1, 라인 40: `const date = new Date(dateStr + 'T00:00:00');`
    - Handler 2, 라인 110: `const date = new Date(dateStr + 'T00:00:00');`
    - Handler 3, 라인 170: `const originalDate = new Date(originalDateStr + 'T00:00:00');`
    - Handler 4, 라인 229: `const date = new Date(dateStr + 'T00:00:00');`

  **Bug #7 (LOW)**: 라인 ~194, ~239
  - Handler 3 (`edit_booking_submit`): `updateBooking` 호출 전 가드 추가
    ```typescript
    if (!oldBooking) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 수정 또는 삭제되었을 수 있습니다.',
      });
      return;
    }
    ```
    기존 `if (oldBooking)` 조건문들을 이 가드 이후로 이동하여 non-null로 안전하게 사용

  - Handler 4 (`edit_cancel_confirm`): `cancelBooking` 호출 전 가드 추가
    ```typescript
    if (!booking) {
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ 선택한 예약을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.',
      });
      return;
    }
    ```
    기존 `if (booking)` 조건문 제거하고 가드 이후 직접 사용

  **수정 순서**: Bug #3 → Bug #2 → Bug #4 → Bug #6 → Bug #7 (상→하 순서로 수정하여 라인 번호 변동 최소화)
  
  각 수정 후 `npx tsc --noEmit` 실행

  **Must NOT do**:
  - Handler 3, Handler 4의 핵심 비즈니스 로직(updateBooking, cancelBooking 호출 방식) 변경 금지
  - `conversation.ts` 수정 금지
  - callback_id 변경 금지
  - 새로운 import 추가 금지 (이미 사용 중인 logger, buildErrorView 등 활용)
  - 날짜 처리 유틸리티 함수 추출 금지 — 각 라인에 `+09:00`만 추가

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 모두 같은 파일 내 수술적 수정. 로직 변경 없이 가드/로깅/포맷 추가.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: 브라우저 관련 아님

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None
  - **Note**: Task 1과 결합 관계 — Bug #1 + Bug #3이 함께 동작해야 완전한 수정. 같은 Wave에서 병렬 실행되므로 OK.

  **References**:

  **Pattern References**:
  - `src/listeners/views/edit-submit.ts:11-84` — Handler 1 전체. Bugs #2, #3, #4, #6 수정 위치.
  - `src/listeners/views/edit-submit.ts:87-148` — Handler 2. Bug #6 수정 위치 (라인 110).
  - `src/listeners/views/edit-submit.ts:151-216` — Handler 3. Bugs #6, #7 수정 위치.
  - `src/listeners/views/edit-submit.ts:219-257` — Handler 4. Bugs #6, #7 수정 위치.
  - `src/views/common.ts:67-68` — `parseDateTimeString` 함수: `new Date(\`\${dateStr}T\${timeStr}:00+09:00\`)` — Bug #6의 참조 패턴. 이미 `+09:00`을 올바르게 사용.

  **API/Type References**:
  - `src/views/result-views.ts` — `buildErrorView(message)` — Bug #2에서 사용할 에러 뷰
  - `src/views/result-views.ts` — `buildProcessingView()` — 이미 Handler 1에서 import됨

  **WHY Each Reference Matters**:
  - `edit-submit.ts:32-38` — Bug #2: 빈 catch 블록의 정확한 위치. `logger`는 Handler의 파라미터로 이미 사용 가능.
  - `edit-submit.ts:58` — Bug #3: 대소문자 비교의 정확한 위치. Bug #1 수정 후 이것이 유일한 소유권 검증.
  - `edit-submit.ts:45-55` — Bug #4: Promise.allSettled 루프. `result.status === 'fulfilled'` 분기 옆에 `else` 추가.
  - `common.ts:67-68` — Bug #6 참조 패턴: `+09:00` 사용 방식의 기준.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Bug #3 — 이메일 비교가 대소문자 무시하는지 확인
    Tool: Bash (grep)
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. grep -n "toLowerCase" src/listeners/views/edit-submit.ts
      2. organizer 비교 근처에 .toLowerCase()가 양쪽에 있는지 확인
    Expected Result: b.organizer.toLowerCase() === organizerEmail.toLowerCase() 패턴 존재
    Failure Indicators: toLowerCase 없거나 한쪽만 있음
    Evidence: .sisyphus/evidence/task-3-case-insensitive.txt

  Scenario: Bug #2 — 빈 catch 블록이 제거되었는지 확인
    Tool: Bash (grep)
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. grep -B2 -A5 "이메일 조회 실패\|emailError\|사용자 정보" src/listeners/views/edit-submit.ts
      2. catch 블록에 logger.error와 buildErrorView 호출이 있는지 확인
    Expected Result: catch 블록에 에러 로깅 + 에러 뷰 반환 코드 존재
    Failure Indicators: 빈 catch 블록 또는 에러 처리 없음
    Evidence: .sisyphus/evidence/task-3-catch-block.txt

  Scenario: Bug #4 — rejected Promise 로깅 확인
    Tool: Bash (grep)
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. grep -n "rejected\|result.reason\|조회 실패" src/listeners/views/edit-submit.ts
      2. Promise.allSettled 루프 내에 logger.warn 호출이 있는지 확인
    Expected Result: rejected 분기에 logger.warn 존재
    Failure Indicators: rejected 처리 없음
    Evidence: .sisyphus/evidence/task-3-rejected-logging.txt

  Scenario: Bug #6 — 모든 T00:00:00이 +09:00을 포함하는지 확인
    Tool: Bash (grep)
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. grep -n "T00:00:00" src/listeners/views/edit-submit.ts
      2. 모든 매치가 "T00:00:00+09:00"인지 확인
      3. grep -c "T00:00:00'" src/listeners/views/edit-submit.ts (따옴표로 끝나는 패턴 — +09:00 없이)
    Expected Result: 모든 T00:00:00 뒤에 +09:00 존재. 따옴표로 직접 끝나는 것 0건.
    Failure Indicators: +09:00 없는 T00:00:00 존재
    Evidence: .sisyphus/evidence/task-3-timezone-fix.txt

  Scenario: Bug #7 — updateBooking/cancelBooking 전 가드 확인
    Tool: Bash (grep)
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. grep -B3 "updateBooking\|cancelBooking" src/listeners/views/edit-submit.ts
      2. 각 호출 전에 if (!oldBooking) 또는 if (!booking) 가드가 있는지 확인
    Expected Result: updateBooking 전 oldBooking 가드, cancelBooking 전 booking 가드 존재
    Failure Indicators: 가드 없이 직접 호출
    Evidence: .sisyphus/evidence/task-3-booking-guards.txt

  Scenario: TypeScript 빌드 성공 확인
    Tool: Bash
    Preconditions: edit-submit.ts 수정 완료
    Steps:
      1. npx tsc --noEmit
    Expected Result: exit code 0, 출력 없음
    Failure Indicators: 컴파일 에러
    Evidence: .sisyphus/evidence/task-3-tsc-check.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2)
  - Message: `fix(edit-submit): fix email lookup, case comparison, timezone, logging, validation`
  - Files: `src/listeners/views/edit-submit.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [ ] 4. 빌드 검증 + 배포

  **What to do**:
  - `npx tsc --noEmit` 실행 — 전체 프로젝트 TypeScript 검증
  - `npm run build` 실행 — dist/ 디렉토리 생성 확인
  - 모든 grep assertion 실행:
    - `grep "privateExtendedProperty" src/services/calendar.ts` → 0 matches
    - `grep "T00:00:00'" src/listeners/views/edit-submit.ts` → 0 matches (따옴표로 끝나는 것)
    - `grep "toLowerCase" src/listeners/views/edit-submit.ts` → organizer 비교 근처
    - `grep "slice\|substring\|75" src/views/edit-modal.ts` → 절단 로직 존재
  - git add + commit + push (Tasks 1-3 변경사항을 하나의 커밋으로)
  - Render 자동 배포 대기 또는 수동 배포 트리거

  **Must NOT do**:
  - 소스 코드 추가 수정 금지
  - 새로운 기능 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 빌드 + 배포 명령어 실행
  - **Skills**: [`git-master`]
    - `git-master`: git commit + push 작업에 필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `package.json` — `build` 스크립트 확인
  - `.git/` — git remote 설정 확인

  **WHY Each Reference Matters**:
  - `package.json` — build 명령어 확인 (npm run build)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript 전체 빌드 성공
    Tool: Bash
    Preconditions: Tasks 1-3 완료
    Steps:
      1. npx tsc --noEmit
      2. exit code 확인
    Expected Result: exit code 0, 에러 없음
    Failure Indicators: 컴파일 에러 출력
    Evidence: .sisyphus/evidence/task-4-tsc-full.txt

  Scenario: npm build 성공
    Tool: Bash
    Preconditions: tsc 통과
    Steps:
      1. npm run build
      2. dist/ 디렉토리 존재 확인
    Expected Result: 빌드 성공, dist/ 생성됨
    Failure Indicators: 빌드 에러 또는 dist/ 없음
    Evidence: .sisyphus/evidence/task-4-npm-build.txt

  Scenario: 전체 grep assertion 통과
    Tool: Bash
    Preconditions: 빌드 성공
    Steps:
      1. grep -c "privateExtendedProperty" src/services/calendar.ts → 0
      2. grep -c "T00:00:00'" src/listeners/views/edit-submit.ts → 0
      3. grep -c "toLowerCase" src/listeners/views/edit-submit.ts → 2 이상
    Expected Result: 모든 assertion 통과
    Failure Indicators: 예상과 다른 카운트
    Evidence: .sisyphus/evidence/task-4-grep-assertions.txt

  Scenario: git push 에러 없이 성공
    Tool: Bash
    Preconditions: 빌드 + assertion 통과
    Steps:
      1. git add src/services/calendar.ts src/listeners/views/edit-submit.ts src/views/edit-modal.ts
      2. git commit -m "fix(edit-cancel): fix 7 bugs in edit/cancel booking flow"
      3. git push
    Expected Result: push 성공
    Failure Indicators: push 실패 (remote 설정, 인증 등)
    Evidence: .sisyphus/evidence/task-4-git-push.txt
  ```

  **Commit**: YES
  - Message: `fix(edit-cancel): fix 7 bugs in edit/cancel booking flow`
  - Files: `src/services/calendar.ts`, `src/listeners/views/edit-submit.ts`, `src/views/edit-modal.ts`
  - Pre-commit: `npx tsc --noEmit`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  이 계획을 처음부터 끝까지 읽고, 각 "Must Have" 항목이 구현되었는지 확인 (파일 읽기, grep). 각 "Must NOT Have" 항목에 대해 금지된 패턴이 코드베이스에 없는지 검색. `.sisyphus/evidence/` 파일들이 존재하는지 확인. 계획의 deliverables 대비 실제 결과물 비교.
  Output: `Must Have [7/7] | Must NOT Have [N/N] | Tasks [4/4] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  `npx tsc --noEmit` + `npm run build` 실행. 변경된 3개 파일 리뷰: `as any`/`@ts-ignore`, 빈 catch 블록, console.log (logger 대신), 주석 처리된 코드, 사용하지 않는 import 검사. AI slop 확인: 과도한 주석, 과도한 추상화, 제네릭 변수명.
  Output: `Build [PASS/FAIL] | Files [3 clean/N issues] | VERDICT`

- [ ] F3. **Real QA — Grep Assertions** — `unspecified-high`
  모든 grep assertion을 독립적으로 재실행. `privateExtendedProperty` 완전 제거 확인. `toLowerCase` 존재 확인. `T00:00:00+09:00` 패턴 확인. 75자 절단 로직 확인. booking 가드 확인. rejected 로깅 확인. evidence를 `.sisyphus/evidence/final-qa/`에 저장.
  Output: `Assertions [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  각 Task의 "What to do" 내용과 실제 diff 비교 (git diff). 1:1 매칭 확인 — spec에 있는 것은 모두 구현됨(누락 없음), spec에 없는 것은 구현 안 됨(scope creep 없음). "Must NOT do" 준수 확인. Task 간 파일 오염 확인 (Task 1이 edit-submit.ts를 건드렸는지 등).
  Output: `Tasks [4/4 compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Tasks 1-3**: 하나의 커밋으로 묶음
  - `fix(edit-cancel): fix 7 bugs in edit/cancel booking flow`
  - Files: `src/services/calendar.ts`, `src/listeners/views/edit-submit.ts`, `src/views/edit-modal.ts`
  - Pre-commit: `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit                    # Expected: 0 output (clean build)
npm run build                       # Expected: dist/ created without errors
grep "privateExtendedProperty" src/services/calendar.ts  # Expected: 0 matches
grep -c "toLowerCase" src/listeners/views/edit-submit.ts  # Expected: >= 2
grep "T00:00:00'" src/listeners/views/edit-submit.ts      # Expected: 0 matches
```

### Final Checklist
- [ ] All "Must Have" present (7 bugs fixed)
- [ ] All "Must NOT Have" absent (no forbidden changes)
- [ ] TypeScript build passes
- [ ] npm build succeeds
- [ ] All grep assertions pass
- [ ] Code pushed to GitHub
- [ ] Render deployment successful
