#!/usr/bin/env bash
# Safely prepares Git worktrees for the tasks in .claude/tasks/active/.
# Read-only by default: prints exact commands. Pass --create to actually
# run `git worktree add` (never force, never deletes, never overwrites).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not inside a git repository. Run this from within the FleetPro repo." >&2
  exit 1
fi
cd "$REPO_ROOT"

GIT_DIR="$(git rev-parse --git-dir)"
UNSAFE=0
for marker in "$GIT_DIR/MERGE_HEAD" "$GIT_DIR/CHERRY_PICK_HEAD" "$GIT_DIR/rebase-merge" "$GIT_DIR/rebase-apply" "$GIT_DIR/BISECT_LOG"; do
  if [ -e "$marker" ]; then
    echo "ERROR: repository is mid-operation ($(basename "$marker") present)." >&2
    echo "       Resolve or abort it before preparing worktrees." >&2
    UNSAFE=1
  fi
done
if git ls-files -u | grep -q .; then
  echo "ERROR: unresolved merge conflicts present in the index." >&2
  UNSAFE=1
fi
if [ "$UNSAFE" -eq 1 ]; then
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "NOTE: main working tree has uncommitted changes. New worktrees are separate"
  echo "      checkouts and won't touch them, but make sure that work is intentional."
  echo ""
fi

TASKS_DIR=".claude/tasks/active"
WORKTREE_BASE="${WORKTREE_BASE:-$(dirname "$REPO_ROOT")/fleetpro-worktrees}"
CREATE=0
if [ "${1:-}" = "--create" ]; then
  CREATE=1
fi

mkdir -p "$TASKS_DIR"

shopt -s nullglob
tasks=("$TASKS_DIR"/TASK-*.md)
if [ ${#tasks[@]} -eq 0 ]; then
  echo "No TASK-*.md files found in $TASKS_DIR."
  echo "Run /ultra-split on a multi-requirement prompt first."
  exit 0
fi

echo "== Parallel worktree plan =="
echo "Worktree base: $WORKTREE_BASE"
echo ""

for f in "${tasks[@]}"; do
  id="$(basename "$f" .md)"
  wname="$(awk '/^## Suggested worktree name/{getline; while ($0 ~ /^$/) getline; print; exit}' "$f" | sed 's/^ *//;s/ *$//')"
  bname="$(awk '/^## Suggested branch name/{getline; while ($0 ~ /^$/) getline; print; exit}' "$f" | sed 's/^ *//;s/ *$//')"
  worker="$(awk '/^## Assigned worker type/{getline; while ($0 ~ /^$/) getline; print; exit}' "$f" | sed 's/^ *//;s/ *$//')"

  if [ -z "$wname" ] || [ "$worker" = "integration-reviewer" ] || [ "$worker" = "repository-explorer" ]; then
    echo "-- $id: no worktree needed (worker: ${worker:-unknown})"
    continue
  fi

  path="$WORKTREE_BASE/$wname"
  echo "-- $id  (worker: $worker)"
  echo "   git worktree add \"$path\" -b \"$bname\""
  echo "   cd \"$path\" && claude --worktree \"$wname\""
  echo ""

  if [ "$CREATE" -eq 1 ]; then
    if git worktree list --porcelain | grep -qx "worktree $path"; then
      echo "   (worktree already exists at $path — skipping)"
      continue
    fi
    if git rev-parse --verify "$bname" >/dev/null 2>&1; then
      echo "   (branch $bname already exists — attaching worktree to it, not overwriting)"
      git worktree add "$path" "$bname"
    else
      git worktree add "$path" -b "$bname"
    fi
    echo ""
  fi
done

if [ "$CREATE" -eq 0 ]; then
  echo "Dry run only. Re-run with --create to actually create the worktrees above"
  echo "(git worktree add only — never force, never deletes, never overwrites)."
fi
