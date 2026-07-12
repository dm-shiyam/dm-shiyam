---
description: Pull latest from origin/main (rebase), then push local commits safely
---

Safely sync the local branch with `origin/main`. Follow these steps in order:

1. Check working tree state with `git status --short`.
   - If there are uncommitted changes, ASK the user whether to:
     (a) Commit them first (with a suggested message based on the changes), or
     (b) Stash them, sync, then restore.
     Do NOT proceed until the user chooses.

2. Show what will be pulled: `git fetch origin && git log --oneline HEAD..origin/main | head -20`.
   - If there are incoming commits, briefly summarize them.

3. Show what will be pushed: `git log --oneline origin/main..HEAD | head -10`.
   - Warn if any commit contains obvious secrets keywords (grep for `AKIA`, `sk_live`, `password=`, `API_KEY=` in `git log -p`).

// turbo
4. Pull with rebase: `git pull --rebase origin main`.
   - If a merge conflict occurs, STOP and show the conflicted files to the user. Do NOT attempt automatic resolution.

5. If step 1 was a stash, restore it: `git stash pop`.
   - If pop conflicts, STOP and inform the user.

6. Confirm with the user before pushing.

// turbo
7. Push: `git push origin main`.

8. Show final state: `git log --oneline -5` and `git status`.

Never auto-run `git push --force` or `git reset --hard`. Never delete branches. Always keep the user's uncommitted work safe.
