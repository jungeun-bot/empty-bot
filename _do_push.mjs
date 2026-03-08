import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
const run = (cmd) => { console.log(`> ${cmd}`); console.log(execSync(cmd, { encoding: 'utf8', cwd: String.raw`C:\Users\황병하\slack-room-bot` })); };

run(`"${git}" add -A`);
run(`"${git}" status --short`);
run(`"${git}" commit -m "feat: 예약 취소/수정 시 Google Sheets 기록 + 봇 이름 미팅룸/포커스룸으로 통일"`);
run(`"${git}" push origin main`);
