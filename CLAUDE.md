# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@.ai/AGENTS.md

## Project Overview

Alcedo is a personal operating system integrating task, habit, and belief management across Android and PC. The repo currently contains two subprojects:

- `pc-server/` — Fastify (Node.js) REST API + SQLite backend for the PC
- `web-app/` — React + Vite frontend (PC dashboard)

The Android app is a separate repository (not present here). Phase 1 is Android → PC one-way sync; future phases add bidirectional sync, Obsidian integration, and analytics.

## Development Commands

See `.claude/skills/run-dev-servers/SKILL.md` for all dev/build/preview commands, env vars, and startup verification.

## Architecture

### Data flow
```
Android App  →  POST /api/v1/sync/tasks  →  pc-server  →  SQLite (pc-server/data/app.sqlite)
Web App      ↔  REST API                 ↔  pc-server
```

### PC Server (`pc-server/src/`)
- `index.ts` — reads `.env`, starts Fastify on `PORT` (default 8787)
- `app.ts` — creates Fastify instance, registers `X-Api-Key` auth hook, mounts routes under `/api/v1`
- `db.ts` — opens SQLite, creates schema, runs inline migration patches (checks for missing columns before `ALTER TABLE`)
- `routes/tasks.ts` — task upsert/delete/list/sync-changes endpoints
- `routes/beliefs.ts` — belief CRUD
- `routes/habits.ts` — habit CRUD + daily check-in + streak calculation

### Web App (`web-app/src/`)
- `api.ts` — all typed API calls; each function takes `(serverUrl, apiKey, ...)` so connection config stays in the caller
- `App.tsx` — root state (tasks, serverUrl, apiKey); passes callbacks down
- `pages/DashboardPage.tsx` — main page composition
- `components/` — TasksPanel, HabitsPanel, BeliefsPanel, TaskList, NewTaskForm, ServerConfigBar

### Key data model decisions
- **Tasks** use a version-based conflict resolution: upsert wins only when `incoming.version > stored.version` (or same version with newer `updatedAt`). This prepares for future bidirectional sync.
- **Soft delete**: deletes store a tombstone (`deletedAt`) rather than removing the row, enabling sync safety.
- **Subtasks** are stored as a JSON column (`subtasks TEXT`) on the parent task row. The `parentId` column is an alternative flat model — both coexist for backward compatibility.
- **Habits**: streak and `completedToday` are computed at query time in `routes/habits.ts`, not stored.

## Coding Conventions

- All server-side IDs use UUIDs via `crypto.randomUUID()`.
- Dates/times are stored as ISO 8601 strings in SQLite (TEXT columns).
- `isActive` booleans are stored as `INTEGER` (0/1) in SQLite; normalize with `Boolean()` on read.
- Route files export a named `register*Routes` function following the Fastify plugin pattern.
- `normalizeSubtasks()` exists in both `db.ts` (server) and `api.ts` (client) — keep them in sync when changing the subtask shape.
- No test framework is set up yet; verify changes manually with curl or the web UI.

## Key Spec References

- Full requirements: `docs/REQUIREMENTS.md`
- Technical spec (data schema, API contracts, phased roadmap): `docs/TECH_SPEC.md`
- Agent operating rules: `.github/copilot-instructions.md`
