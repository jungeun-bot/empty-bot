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
run(`"${git}" commit -m "fix: privateExtendedProperty \uD544\uD130 \uC81C\uAC70 + \uC624\uB958 \uBA54\uC2DC\uC9C0\uC5D0 \uC870\uD68C \uACC4\uC815 \uD45C\uC2DC"`);
run(`"${git}" log --oneline -3`);
