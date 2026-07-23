# Task File Instructions

Task files are the durable work plans and checkpoint logs for work tracked in
[`../TODO.md`](../TODO.md).

Use one task file for anything bigger than a tiny change or anything that
spans `server/` and `web/`. Keep the file updated as you work so another agent
can resume without reconstructing context from scratch.

## Format

```md
# <Task title>

**Status:** Pending | In progress | Completed
**Owner:** <name | unassigned>
**Estimated effort:** <rough size>
**Created:** YYYY-MM-DD HH:MM IST
**Completed:** YYYY-MM-DD HH:MM IST
**Tracked from:** [`TODO.md`](../TODO.md)

## Goal

What we are building and why.

## Scope

- [ ] Concrete sub-task
- [ ] Another concrete sub-task

## Open Questions

- Record questions that block work and their resolution.

## Files Likely To Change

- List likely files or packages.

## Recovery Hints

How a future agent should resume if the task is stale.

## Checkpoints

- YYYY-MM-DD HH:MM IST - One-line summary of meaningful progress.
```

## Timestamp Rule

Use IST for task files and the root tracker:

```bash
TZ='Asia/Kolkata' date +"%Y-%m-%d %H:%M IST"
```

Do not guess timestamps.

## Archiving Completed Tasks

Root `TODO.md` keeps only active, pending, and recent completed work.
Completed items older than 14 days move into
[`archived/todo.md`](./archived/todo.md).

When archiving a completed task:

1. Move the completed bullet from `../TODO.md` into `archived/todo.md`.
2. Move the matching `tasks/<slug>.md` file into `tasks/archived/` when it
   exists.
3. Update the archived bullet's task link to the new archived task-file path.
4. Remove the completed bullet from root `TODO.md`.

Do not delete old task files just because they aged out of the root tracker.
