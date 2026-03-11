import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
try {
  console.log(execSync(`"${git}" add -A`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" commit -m "fix: 예약 수정 시 중복예약 방지 (resource:true 보존) + 정기회의 수정 허용 + 회의실 변경 시 제목 접두어 자동 업데이트"`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" push origin main`, { encoding: 'utf8' }));
  console.log('=== DONE ===');
  console.log(execSync(`"${git}" log --oneline -3`, { encoding: 'utf8' }));
} catch(e) { console.error(e.stdout || e.message); }
