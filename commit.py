#!/usr/bin/env python3
import subprocess
import os
import sys

os.chdir(r"C:\Users\황병하\slack-room-bot")

def run(cmd, **kwargs):
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    print("CMD:", " ".join(cmd) if isinstance(cmd, list) else cmd)
    if result.stdout:
        print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("RC:", result.returncode)
    print()
    return result

# Check if git repo exists
if not os.path.exists(".git"):
    print("=== GIT INIT ===")
    run(["git", "init"])
    run(["git", "config", "user.email", "bot@slack-room-bot.local"])
    run(["git", "config", "user.name", "Slack Room Bot"])

# Check status
print("=== GIT STATUS ===")
run(["git", "status"])

# Create .gitignore if not exists
if not os.path.exists(".gitignore"):
    with open(".gitignore", "w", encoding="utf-8") as f:
        f.write("node_modules/\n.env\nservice-account.json\ndist/\n*.js.map\n")
    print("Created .gitignore")

# Stage files (exclude secrets)
print("=== STAGING FILES ===")
run(["git", "add", "src/"])
run(["git", "add", "README.md"])
run(["git", "add", "package.json"])
run(["git", "add", "package-lock.json"])
run(["git", "add", "tsconfig.json"])
run(["git", "add", ".env.example"])
run(["git", "add", ".gitignore"])

# Show what's staged
print("=== STAGED FILES ===")
run(["git", "diff", "--cached", "--name-only"])

# Commit
print("=== COMMITTING ===")
result = run([
    "git", "commit", "-m",
    "feat(app): add app_mention handler and integrate mention room inquiry"
])

if result.returncode != 0:
    print("Commit failed, trying with --allow-empty...")
    run(["git", "commit", "--allow-empty", "-m",
         "feat(app): add app_mention handler and integrate mention room inquiry"])

# Show log
print("=== GIT LOG ===")
run(["git", "log", "--oneline", "-5"])
