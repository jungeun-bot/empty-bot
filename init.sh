#!/bin/bash
cd "C:\Users\황병하\slack-room-bot"
git init
git config user.email "bot@slack-room-bot.local"
git config user.name "Slack Room Bot"
if [ ! -f .gitignore ]; then
  echo "node_modules/" > .gitignore
  echo ".env" >> .gitignore
  echo "service-account.json" >> .gitignore
  echo "dist/" >> .gitignore
  echo "*.js.map" >> .gitignore
fi
git add src/ README.md package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "feat(app): add app_mention handler and integrate mention room inquiry"
git log --oneline -3
