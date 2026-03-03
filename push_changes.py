#!/usr/bin/env python3
import subprocess
import os

os.chdir(r"C:\Users\황병하\slack-room-bot")

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    print("CMD:", " ".join(cmd))
    if result.stdout:
        print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print("RC:", result.returncode)
    print()
    return result

print("=== GIT STATUS ===")
run(["git", "status"])

print("=== GIT REMOTE ===")
run(["git", "remote", "-v"])

print("=== GIT LOG (recent) ===")
run(["git", "log", "--oneline", "-5"])

print("=== STAGING ===")
run(["git", "add", "src/listeners/commands/help.ts"])
run(["git", "add", "src/listeners/commands/index.ts"])
run(["git", "add", "USAGE.md"])

print("=== STAGED FILES ===")
run(["git", "diff", "--cached", "--name-only"])

print("=== COMMITTING ===")
run(["git", "commit", "-m", "feat: add /사용방법 help command and usage guide"])

print("=== PUSHING ===")
run(["git", "push", "origin"])

print("=== FINAL LOG ===")
run(["git", "log", "--oneline", "-5"])
