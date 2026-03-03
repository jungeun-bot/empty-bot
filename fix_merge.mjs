import { execSync } from 'node:child_process';

const GIT = '"C:\\Users\\황병하\\AppData\\Local\\GitHubDesktop\\app-3.5.5\\resources\\app\\git\\cmd\\git.exe"';
const CWD = 'C:\\Users\\황병하\\slack-room-bot';

function run(cmd) {
  console.log(`\n>>> ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: CWD, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
    if (out) console.log(out);
    return true;
  } catch (e) {
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
    console.log('EXIT:', e.status);
    return false;
  }
}

// 1. 잘못된 merge 되돌리기 (우리 커밋으로 복귀)
run(`${GIT} reset --hard 66d7c78`);

// 2. 리모트 히스토리를 merge하되, 충돌 시 우리(로컬) 코드 우선
run(`${GIT} merge origin/main --allow-unrelated-histories --strategy-option ours --no-edit`);

// 3. 결과 확인
run(`${GIT} log --oneline -5`);
run(`${GIT} status`);
run(`${GIT} diff --name-only HEAD~1`);
