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
    return false;
  }
}

run(`${GIT} add src/views/book-modal.ts`);
run(`${GIT} commit -m "fix: remove (옵션) label from attendees field in book modal"`);
run(`${GIT} log --oneline -3`);
