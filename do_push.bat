@echo off
chcp 65001 >nul

echo === STATUS ===
git status

echo === REMOTE ===
git remote -v

echo === LOG ===
git log --oneline -5

echo === ADD AND COMMIT ===
git add src/listeners/commands/help.ts USAGE.md src/listeners/commands/index.ts dist/
git status

echo === COMMITTING ===
git commit -m "feat: /사용방법 커맨드 추가 및 사용 가이드 문서 작성"

echo === PUSHING ===
git push origin

echo === DONE ===
