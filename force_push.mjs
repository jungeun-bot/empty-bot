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

// GitHub Desktop의 credential helper 설정 활용
run(`${GIT} config --local credential.helper manager`);

// force push로 리모트 덮어쓰기
run(`${GIT} push -u origin main --force`);

console.log('\n===== DONE =====');
