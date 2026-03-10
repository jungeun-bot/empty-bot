import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
const run = (cmd) => { console.log(`> ${cmd}`); console.log(execSync(cmd, { encoding: 'utf8', cwd: process.cwd() })); };

run(`"${git}" status`);
run(`"${git}" diff --stat`);
run(`"${git}" add -A`);
run(`"${git}" commit -m "feat: 봇 메시지에 한글 표시이름(빈방있소) 적용 — chat:write.customize 스코프 추가 및 모든 postMessage/postEphemeral에 username 파라미터 추가"`);
run(`"${git}" push`);
