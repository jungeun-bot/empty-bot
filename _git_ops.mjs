import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
try {
  console.log(execSync(`"${git}" add -A`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" commit -m "fix: @gmail.com 등 외부 도메인 DWD 인증 실패 시에도 admin fallback 작동하도록 에러 패턴 확장"`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" push origin main`, { encoding: 'utf8' }));
  console.log('=== DONE ===');
  console.log(execSync(`"${git}" log --oneline -3`, { encoding: 'utf8' }));
} catch(e) { console.error(e.stdout || e.message); }
