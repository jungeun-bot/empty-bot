import { execSync } from 'child_process';

const git = String.raw`C:\Users\황병하\AppData\Local\GitHubDesktop\app-3.5.5\resources\app\git\cmd\git.exe`;

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() });
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (e) {
    console.error('ERROR:', e.stderr || e.message);
    throw e;
  }
}

run(`"${git}" add -A`);
run(`"${git}" status`);
run(`"${git}" commit -m "fix: /\uC218\uC815 \uC608\uC57D \uC870\uD68C \uADFC\uBCF8 \uC218\uC815 - room calendar \uB300\uC2E0 user primary calendar \uC870\uD68C"`);
run(`"${git}" log --oneline -3`);
