import { execSync } from 'child_process';

const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() });
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (e) {
    console.error('ERROR:', e.stderr || e.message);
    throw e;
  }
}

run(`"${git}" add -A`);
run(`"${git}" status`);
run(`"${git}" commit -m "fix: /수정 예약 조회 안 되는 버그 수정 - BookingEvent에 creator 필드 추가 - listRoomEvents에서 creator 필드 반환 - edit-submit에서 organizer/creator/attendees 모두 확인하여 본인 예약 필터 - 디버그 로그 추가 (organizer/creator/attendees 출력)"`);
run(`"${git}" log --oneline -3`);
