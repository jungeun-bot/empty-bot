import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
const run = (cmd) => { console.log(`> ${cmd}`); console.log(execSync(cmd, { encoding: 'utf8', cwd: String.raw`C:\Users\황병하\slack-room-bot` })); };

run(`"${git}" add -A`);
run(`"${git}" status --short`);
run(`"${git}" commit -m "feat: 예약 생성 시 예약자 본인을 참석자에 자동 포함"`);
run(`"${git}" push origin main`);
