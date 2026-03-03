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
run(`"${git}" commit -m "fix: remove a.resource===true filter, use roomIdSet+suffix matching for reliable room detection"`);
run(`"${git}" log --oneline -5`);
