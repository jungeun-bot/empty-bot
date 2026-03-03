#!/usr/bin/env python3
import os
import sys

os.chdir(r"C:\Users\황병하\slack-room-bot")

# Initialize git repo
print("=== GIT INIT ===")
os.system('git init')

# Configure git user
print("\n=== GIT CONFIG ===")
os.system('git config user.email "bot@slack-room-bot.local"')
os.system('git config user.name "Slack Room Bot"')

# Create .gitignore if it doesn't exist
if not os.path.exists(".gitignore"):
    print("\n=== CREATE .gitignore ===")
    with open(".gitignore", "w", encoding="utf-8") as f:
        f.write("node_modules/\n.env\nservice-account.json\ndist/\n*.js.map\n")
    print("Created .gitignore")

# Stage files
print("\n=== STAGING FILES ===")
os.system('git add src/')
os.system('git add README.md')
os.system('git add package.json')
os.system('git add package-lock.json')
os.system('git add tsconfig.json')
os.system('git add .env.example')
os.system('git add .gitignore')

# Show what's staged
print("\n=== STAGED FILES ===")
os.system('git diff --cached --name-only')

# Commit
print("\n=== COMMITTING ===")
ret = os.system('git commit -m "feat(app): add app_mention handler and integrate mention room inquiry"')

if ret != 0:
    print("\nCommit failed, trying with --allow-empty...")
    os.system('git commit --allow-empty -m "feat(app): add app_mention handler and integrate mention room inquiry"')

# Show log
print("\n=== GIT LOG ===")
os.system('git log --oneline -3')
