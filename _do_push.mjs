import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
const run = (cmd) => { console.log(`> ${cmd}`); console.log(execSync(cmd, { encoding: 'utf8', cwd: String.raw`C:\Users\황병하\slack-room-bot` })); };

run(`"${git}" add -A`);
run(`"${git}" status --short`);
run(`"${git}" commit -m "refactor: 사용자 검색 순서 Slack 우선으로 변경 (다중 도메인 지원)"`);
run(`"${git}" push origin main`);
