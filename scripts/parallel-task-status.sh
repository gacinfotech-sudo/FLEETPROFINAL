#!/usr/bin/env bash
# Read-only status summary of the parallel task orchestration system.
# Safe to run any time; makes no changes.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not inside a git repository." >&2
  exit 1
fi
cd "$REPO_ROOT"

ACTIVE=".claude/tasks/active"
COMPLETED=".claude/tasks/completed"
REPORTS=".claude/tasks/reports"

echo "== Parallel task status =="
echo ""

if [ -f "$ACTIVE/MANIFEST.md" ]; then
  echo "-- Manifest --"
  echo "$ACTIVE/MANIFEST.md"
else
  echo "-- Manifest --"
  echo "(none — run /ultra-split on a multi-requirement prompt)"
fi
echo ""

shopt -s nullglob

echo "-- Active tasks --"
active_tasks=("$ACTIVE"/TASK-*.md)
if [ ${#active_tasks[@]} -eq 0 ]; then
  echo "(none)"
else
  for f in "${active_tasks[@]}"; do
    id="$(basename "$f" .md)"
    report="$REPORTS/${id}-report.md"
    if [ -f "$report" ]; then
      status="$(awk '/^## Status/{getline; while ($0 ~ /^$/) getline; print; exit}' "$report" | sed 's/^ *//;s/ *$//')"
      echo "  $id: ${status:-report present, status unclear}"
    else
      echo "  $id: no report yet"
    fi
  done
fi
echo ""

echo "-- Completed tasks --"
completed_tasks=("$COMPLETED"/TASK-*.md)
if [ ${#completed_tasks[@]} -eq 0 ]; then
  echo "(none)"
else
  for f in "${completed_tasks[@]}"; do
    echo "  $(basename "$f" .md)"
  done
fi
echo ""

echo "-- Git worktrees --"
git worktree list
echo ""

echo "-- Integration report --"
if [ -f "$REPORTS/INTEGRATION-report.md" ]; then
  echo "  present: $REPORTS/INTEGRATION-report.md"
else
  echo "  not yet produced"
fi
