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

// 1. git init
console.log('===== GIT INIT =====');
run(`${GIT} init`);

// 2. remote 연결
console.log('===== ADD REMOTE =====');
run(`${GIT} remote add origin https://github.com/veronica-rona/Room-bot.git`);
run(`${GIT} remote -v`);

// 3. stage all source files
console.log('===== STAGING =====');
run(`${GIT} add src/`);
run(`${GIT} add USAGE.md`);
run(`${GIT} add package.json`);
run(`${GIT} add package-lock.json`);
run(`${GIT} add tsconfig.json`);
run(`${GIT} add .env.example`);
run(`${GIT} add .gitignore`);
run(`${GIT} add README.md`);

// 4. staged 확인
console.log('===== STAGED FILES =====');
run(`${GIT} diff --cached --name-only`);

// 5. commit
console.log('===== COMMIT =====');
run(`${GIT} commit -m "feat: add /사용방법 help command and usage guide"`);

// 6. push (main 브랜치)
console.log('===== PUSH =====');
run(`${GIT} branch -M main`);
run(`${GIT} push -u origin main`);

// 7. 결과 확인
console.log('===== RESULT =====');
run(`${GIT} log --oneline -5`);
run(`${GIT} status`);
