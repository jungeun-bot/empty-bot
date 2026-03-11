import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
try {
  console.log(execSync(`"${git}" add -A`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" commit -m "feat: 정기회의 전체 시간 일괄 변경 기능 추가 — /수정에서 '전체 정기일정 시간 변경' 선택 가능"`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" push origin main`, { encoding: 'utf8' }));
  console.log('=== DONE ===');
  console.log(execSync(`"${git}" log --oneline -5`, { encoding: 'utf8' }));
} catch(e) { console.error(e.stdout || e.message); }
