---
name: git-guardrails
description: Block dangerous git commands (push, reset --hard, clean, branch -D, etc.) in OpenCode via the permission system. Use when user wants to prevent destructive git operations.
---

# Setup Git Guardrails

Blocks dangerous git commands using OpenCode's built-in permission system — no hooks or scripts required.

## What Gets Blocked

- `git push` (all variants including `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

When blocked, OpenCode tells the model it does not have authority to run the command.

## Steps

### 1. Ask scope

Ask the user: install for **this project only** (`opencode.json`) or **all projects** (`~/.config/opencode/opencode.json`)?

### 2. Add permission rules

Add to the appropriate `opencode.json` file:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "allow",
      "git push *": "deny",
      "git reset --hard *": "deny",
      "git clean -f *": "deny",
      "git clean -fd *": "deny",
      "git branch -D *": "deny",
      "git checkout . *": "deny",
      "git restore . *": "deny"
    }
  }
}
```

If the file already exists, merge the `permission.bash` rules — don't overwrite other settings.

### 3. Ask about customization

Ask if user wants to add or remove any patterns from the blocked list. Edit the config accordingly.
