# FleetPro — Claude Code project instructions

## Parallel task dispatch

Before starting work on any prompt, check: does this request contain two or more
independent requirements? If so, follow `.claude/rules/parallel-dispatch.md` instead of
processing it as one large task — that file defines how to split, classify, assign file
ownership, and parallelize the work across worktrees and workers.

To generate the task manifest for a multi-requirement prompt, use the `/ultra-split`
skill (`.claude/skills/ultra-split/SKILL.md`).

Worker agent definitions live in `.claude/agents/`: `repository-explorer`,
`frontend-worker`, `backend-worker`, `database-worker`, `test-worker`,
`integration-reviewer`.

Utility scripts:
- `scripts/prepare-worktrees.sh [--create]` — plan/create Git worktrees for active tasks.
- `scripts/parallel-task-status.sh` — read-only status of active/completed tasks.

This orchestration system does not change FleetPro's application behavior — it only
governs how Claude Code plans and parallelizes work in this repo.
