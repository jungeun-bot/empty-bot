import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
try {
  console.log(execSync(`"${git}" add -A`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" commit -m "refactor: timepicker를 텍스트 입력으로 변경 — 시간 자유 입력 + HH:MM 유효성 검증"`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" push origin main`, { encoding: 'utf8' }));
  console.log('=== DONE ===');
  console.log(execSync(`"${git}" log --oneline -3`, { encoding: 'utf8' }));
} catch(e) { console.error(e.stdout || e.message); }
