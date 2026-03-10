import { execSync } from 'child_process';
const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;
try {
  console.log(execSync(`"${git}" add -A`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" commit -m "fix: Render 배포 빌드 보장 — typescript를 dependencies로 이동 + postinstall 자동 빌드"`, { encoding: 'utf8' }));
  console.log(execSync(`"${git}" push origin main`, { encoding: 'utf8' }));
  console.log('=== DONE ===');
  console.log(execSync(`"${git}" log --oneline -3`, { encoding: 'utf8' }));
} catch(e) { console.error(e.stdout || e.message); }
