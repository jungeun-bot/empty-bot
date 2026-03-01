# Slack 회의실 예약 봇 (slack-room-bot)

Google Calendar와 연동하여 Slack에서 간편하게 회의실을 예약하고 관리할 수 있는 봇입니다.

## 1. 프로젝트 소개

이 프로젝트는 Google Workspace의 회의실 리소스를 Slack 인터페이스를 통해 예약할 수 있게 돕습니다. 복잡한 캘린더 화면 대신 익숙한 채팅창에서 모든 예약 과정을 처리합니다.

### 주요 기능
*   **/book 커맨드**: 모달 UI를 통해 날짜, 시간, 회의 이름, 참석자를 선택하여 예약합니다. 회의실/포커싱룸 유형 선택을 지원합니다.
*   **/now-book [인원수] 커맨드**: 현재 비어 있는 회의실 중 조건에 맞는 곳을 즉시 예약합니다.
*   **/edit 커맨드**: 날짜와 회의실을 선택하여 기존 예약을 수정하거나 취소할 수 있습니다.
*   **DM 대화형 예약**: 봇에게 DM으로 자연어 메시지를 보내면 대화를 통해 예약이 진행됩니다.
*   **@멘션 대화형 예약**: 채널에서 봇을 멘션하여 예약 의도를 표현하면 대화형 예약 흐름이 시작됩니다.
*   **포커싱룸 예약**: 1인용 포커싱룸(FR4~FR9)을 커맨드 또는 대화형으로 예약할 수 있습니다.
*   **예약 수정/취소**: `/edit` 커맨드 또는 대화형 흐름을 통해 본인의 예약을 수정하거나 취소합니다.
*   **참석자 변경 알림**: 예약이 수정되거나 취소되면 참석자들에게 Slack DM으로 알림이 발송됩니다.
*   **Workflow Builder 연동**: Custom Functions(book_room, edit_booking, cancel_booking)을 통해 Workflow Builder에서 예약을 자동화할 수 있습니다.
*   **멤버 자동완성**: Google Directory API와 Slack 사용자 목록을 활용해 참석자를 쉽게 추가합니다.
*   **중복 예약 방지**: FreeBusy API와 내부 뮤텍스 로직을 통해 동일 시간대 중복 예약을 철저히 차단합니다.

### 기술 스택
*   **Runtime**: Node.js 18+
*   **Language**: TypeScript
*   **Framework**: Slack Bolt v4
*   **API**: Google Calendar API, Google Admin SDK (Directory API)

## 2. 사전 요구사항

시작하기 전에 다음 권한과 환경이 준비되어야 합니다.
*   Node.js 18 버전 이상이 설치된 환경
*   Google Workspace 관리자 권한 (서비스 계정 설정 및 도메인 전체 권한 위임 필요)
*   Slack 워크스페이스 관리자 권한 (앱 생성 및 스코프 설정 필요)

## 3. Slack 앱 설정 단계

1.  [Slack API 사이트](https://api.slack.com/apps)에서 **Create New App**을 클릭합니다.
2.  **From scratch**를 선택하고 앱 이름과 워크스페이스를 지정합니다.
3.  **Settings > Socket Mode** 메뉴에서 **Enable Socket Mode**를 활성화합니다. 이때 생성되는 **App-Level Token**을 복사해 두세요. (스코프: `connections:write`)
4.  **Features > Slash Commands**에서 다음 커맨드를 등록합니다.
    *   `/book`: 회의실 예약 모달 열기
    *   `/now-book`: 즉시 예약 실행
    *   `/edit`: 예약 수정/취소 모달 열기
5.  **Features > OAuth & Permissions**의 **Bot Token Scopes** 섹션에서 다음 권한을 추가합니다.
    *   `commands`
    *   `chat:write`
    *   `users:read`
    *   `users:read.email`
    *   `app_mentions:read`
    *   `im:history`
6.  **Features > Event Subscriptions**에서 **Enable Events**를 활성화하고 다음 이벤트를 구독합니다.
    *   `app_mention`
    *   `message.im`
7.  페이지 상단의 **Install to Workspace**를 클릭하여 앱을 설치하고 **Bot User OAuth Token**을 복사합니다.

## 4. Google 서비스 계정 설정 단계

1.  [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트를 생성합니다.
2.  **API 및 서비스 > 라이브러리**에서 **Google Calendar API**와 **Admin SDK API**를 찾아 활성화합니다.
3.  **IAM 및 관리자 > 서비스 계정**에서 새 서비스 계정을 생성합니다.
4.  생성된 계정의 **키** 탭에서 **키 추가 > 새 키 만들기**를 선택하고 JSON 형식으로 다운로드합니다.
5.  **도메인 전체 권한 위임 (Domain-Wide Delegation)** 설정:
    *   [Google 관리 콘솔](https://admin.google.com/)에 접속합니다.
    *   **보안 > 액세스 및 데이터 제어 > API 제어 > 도메인 전체 권한 위임 관리**로 이동합니다.
    *   **새로 추가**를 클릭하고 서비스 계정의 **클라이언트 ID**를 입력합니다.
    *   다음 OAuth 범위를 등록합니다:
        *   `https://www.googleapis.com/auth/calendar`
        *   `https://www.googleapis.com/auth/admin.directory.user.readonly`

## 5. 환경변수 설정

프로젝트 루트에 있는 `.env.example` 파일을 `.env`로 복사한 뒤 아래 항목들을 채워 넣습니다.

*   `SLACK_BOT_TOKEN`: Slack 앱의 Bot User OAuth Token (xoxb-...)
*   `SLACK_APP_TOKEN`: Slack 앱의 App-Level Token (xapp-...)
*   `SLACK_SIGNING_SECRET`: Slack 앱의 Signing Secret
*   `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`: 다운로드한 서비스 계정 JSON 키 파일의 경로
*   `GOOGLE_ADMIN_EMAIL`: 도메인 전체 권한 위임을 실행할 관리자 이메일 주소
*   `GOOGLE_CALENDAR_TIMEZONE`: 예약 시 기준이 될 시간대 (예: Asia/Seoul)
*   `ROOMS_CONFIG`: 회의실 목록 정보를 담은 JSON 배열 (선택 사항)

## 6. 회의실 등록 방법

봇이 회의실을 인식하려면 Google Workspace에 리소스가 등록되어 있어야 합니다.

1.  [Google 관리 콘솔](https://admin.google.com/)의 **빌딩 및 리소스 > 리소스 관리**에서 회의실을 등록합니다.
2.  등록된 회의실의 **리소스 이메일** 주소를 확인합니다.
3.  확인한 이메일 주소를 `.env` 파일의 `ROOMS_CONFIG` 항목에 추가합니다.
4.  자세한 등록 방법은 [Google 고객센터 가이드](https://support.google.com/a/answer/1033925)를 참고하세요.

## 7. 실행 방법

아래 명령어를 순서대로 실행하여 봇을 구동합니다.

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 실제 값을 입력하세요.

# 개발 모드 실행
npm run dev
```

## 8. 문제 해결 (Troubleshooting)

*   **invalid_auth**: `SLACK_BOT_TOKEN` 값이 올바른지, 앱이 워크스페이스에 정상적으로 설치되었는지 확인하세요.
*   **not_allowed_token_type**: `SLACK_APP_TOKEN`이 `xapp-`으로 시작하는 앱 수준 토큰인지 확인하세요.
*   **GOOGLE_AUTH_ERROR**: 서비스 계정 키 파일의 경로가 정확한지, 파일 내용이 손상되지 않았는지 점검하세요.
*   **Domain-Wide Delegation 에러**: Google 관리 콘솔에서 클라이언트 ID와 OAuth 범위가 정확히 등록되었는지, `GOOGLE_ADMIN_EMAIL`이 올바른지 확인하세요.
*   **회의실이 예약을 거절함**: Google Calendar 설정에서 해당 회의실 리소스가 '초대 자동 수락' 상태인지 확인하세요.

## 9. @멘션 자연어 예약 사용 예시

봇을 채널에 초대한 뒤 아래와 같이 멘션하면 대화형 예약 흐름이 시작됩니다.

```
@봇 내일 오후 2시에 4명 회의실 예약해줘
@봇 3월 5일 10시 미팅루링 잡아줘
@봇 모레 포커싱룸 예약해줘
@봇 예약 취소해줘
```

조회만 할 때(예약 키워드 없이):

```
@봇 지금 회의실 있어?
@봇 내일 오후 2시 10명 회의실
@봇 다음 주 월요일 회의 가능한 곳
```

*   예약 키워드(예약해줘, 잡아줘, 부탑해 등)가 포함되면 대화형 예약 흐름이 시작됩니다.
*   수정/취소 키워드(수정해줘, 취소해줘 등)가 포함되면 대화형 수정/취소 흐름이 시작됩니다.
*   포커싱룸 키워드가 포함되면 포커싱룸 예약 흐름이 시작됩니다.
*   시간 표현이 없으면 현재 시각 기준으로 조회합니다.
*   인원수를 지정하면 해당 인원 이상 수용 가능한 회의실만 표시됩니다.

## 10. DM 대화형 예약

봇에게 직접 DM을 보내면 대화형으로 예약을 진행할 수 있습니다.

```
내일 오후 3시에 5명 회의실 예약해줘
포커싱룸 예약해줘
```

봇이 인원, 참석자, 회의 이름 등을 순차적으로 물어본 후 예약을 완료합니다.

## 11. 회의실 구성

기본 회의실 구성은 다음과 같습니다. `ROOMS_CONFIG` 환경변수로 커스터마이즈 가능합니다.

| 이름 | 유형 | 수용 인원 |
|------|------|-----------|
| Meeting Room 1 | 회의실 | 8명 |
| Meeting Room 2 | 회의실 | 8명 |
| Meeting Room 3 | 회의실 | 5명 |
| Meeting Room 7 | 회의실 | 5명 |
| Focusing Room 4~9 | 포커싱룸 | 각 1명 |

## 12. Workflow Builder 연동

Slack Workflow Builder에서 다음 Custom Functions를 사용할 수 있습니다.

*   **book_room**: 회의실 자동 예약 (입력: start_time, end_time, capacity, title, organizer_email, attendee_emails, room_type)
*   **edit_booking**: 예약 수정 (입력: event_id, room_id, new_title, new_start_time, new_end_time)
*   **cancel_booking**: 예약 취소 (입력: event_id, room_id)
