import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
const run = (cmd) => { console.log(`> ${cmd}`); console.log(execSync(cmd, { encoding: 'utf8', cwd: String.raw`C:\Users\황병하\slack-room-bot` })); };

run(`"${git}" add -A`);
run(`"${git}" status --short`);
run(`"${git}" commit -m "fix: 모든 Calendar API에 DWD fallback 적용 — @filamentree.com 등 외부 도메인 지원"`);
run(`"${git}" push origin main`);
