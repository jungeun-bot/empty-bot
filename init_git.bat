@echo off
cd /d "C:\Users\황병하\slack-room-bot"

REM Initialize git repo
git init

REM Configure git user
git config user.email "bot@slack-room-bot.local"
git config user.name "Slack Room Bot"

REM Create .gitignore if it doesn't exist
if not exist .gitignore (
    (
        echo node_modules/
        echo .env
        echo service-account.json
        echo dist/
        echo *.js.map
    ) > .gitignore
)

REM Stage files
git add src/
git add README.md
git add package.json
git add package-lock.json
git add tsconfig.json
git add .env.example
git add .gitignore

REM Commit
git commit -m "feat(app): add app_mention handler and integrate mention room inquiry"

REM Show log
git log --oneline -3
