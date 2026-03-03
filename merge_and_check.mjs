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

// 리모트 브랜치 확인
run(`${GIT} branch -a`);

// 리모트 히스토리를 우리 코드로 덮어쓰기: merge with --allow-unrelated-histories
run(`${GIT} merge origin/main --allow-unrelated-histories --strategy-option theirs --no-edit`);

// 결과 확인
run(`${GIT} log --oneline -5`);
run(`${GIT} status`);
