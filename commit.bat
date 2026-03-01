@echo off
cd /d "C:\Users\황병하\slack-room-bot"
git status
git add src/ README.md
git commit -m "feat(app): add app_mention handler and integrate mention room inquiry"
git log --oneline -3
