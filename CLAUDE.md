# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@.ai/AGENTS.md

## Project Overview

Alcedo is a personal operating system integrating task, habit, and belief management across Android and PC. The repo contains three subprojects:

- `pc-server/` — Fastify (Node.js) REST API + SQLite backend for the PC
- `web-app/` — React + Vite frontend (PC dashboard)
- `android-app/` — Kotlin/Compose Android app (Room local cache + REST sync client)

Phase 1 is Android → PC one-way sync for tasks, beliefs, and habits; future phases add bidirectional sync, Obsidian integration, and analytics.

## Development Commands

See `.claude/skills/run-dev-servers/SKILL.md` for all dev/build/preview commands, env vars, and startup verification.

## Architecture

### Data flow
```
Android App  →  POST /api/v1/sync/tasks, /api/v1/habits*, /api/v1/sync/beliefs  →  pc-server  →  SQLite (pc-server/data/app.sqlite)
Web App      ↔  REST API                                                        ↔  pc-server
```

### Shared (`shared/`)
- `types.ts` — HTTP wire types shared by both subprojects (Task, Habit, Belief, ActivityLog, etc.)
- `api-errors.ts` — shared error response shapes

### PC Server (`pc-server/src/`)
- `index.ts` — reads `.env`, starts Fastify on `PORT` (default 8787)
- `app.ts` — creates Fastify instance, registers `X-Api-Key` auth hook and `setErrorHandler`, mounts routes under `/api/v1`
- `db.ts` — opens SQLite, runs `runMigrations()`
- `migrations/` — numbered migration files (`001_initial_schema.ts`, `002_add_columns.ts`, `003_activity_logs_reshape.ts`) + `index.ts` runner
- `utils/date.ts` — JST-safe date helpers: `localDateKey()` / `effectiveLocalDate()` (UTC+9 fixed, no system-TZ dependency)
- `routes/tasks.ts` — task upsert/delete/list/sync-changes endpoints; contains `normalizeSubtasks()`
- `routes/beliefs.ts` — belief CRUD
- `routes/habits.ts` — habit CRUD + daily check-in + streak calculation
- `routes/activity.ts` — activity log ingest and query
- `routes/analytics.ts` — daily analytics aggregation
- `routes/events.ts` — SSE broadcast (`broadcast()` called by tasks route on mutation)

### Web App (`web-app/src/`)
- `api.ts` — all typed API calls; re-exports wire types from `@shared/types`
- `App.tsx` — root state (tasks); wraps app in `AppConfigContext.Provider` and `ToastContext.Provider`
- `contexts/AppConfigContext.tsx` — provides `serverUrl`/`apiKey` via `useAppConfig()`
- `contexts/ToastContext.tsx` — provides `useToast()` for in-app notifications
- `hooks/useEditableRow.ts` — shared inline-edit state for BeliefRow / HabitRow
- `hooks/useAnalytics.ts` — analytics fetch/filter state for AnalyticsPage
- `utils/format.ts` — `formatDuration`, `formatDurationJa`, `toISO`, `isoToLocalTime`
- `pages/DashboardPage.tsx` — main page composition (tasks, habits, beliefs, activity timeline)
- `pages/AnalyticsPage.tsx` — analytics dashboard
- `pages/SettingsPage.tsx` — server connection settings
- `components/` — TasksPanel, HabitsPanel, BeliefsPanel, NewTaskForm, ServerConfigBar, etc.
- `components/tasks/` — TaskRow, taskTreeUtils.ts, useTaskTree.ts (decomposed from old monolithic TaskList)

### Key data model decisions
- **Tasks** use a version-based conflict resolution: upsert wins only when `incoming.version > stored.version` (or same version with newer `updatedAt`). This prepares for future bidirectional sync.
- **Soft delete**: deletes store a tombstone (`deletedAt`) rather than removing the row, enabling sync safety.
- **Subtasks** are stored as a JSON column (`subtasks TEXT`) on the parent task row. The `parentId` column is an alternative flat model — both coexist for backward compatibility.
- **Habits**: streak and `completedToday` are computed at query time in `routes/habits.ts`, not stored.

## Coding Conventions

### IDs / dates / booleans
- All server-side IDs use UUIDs via `crypto.randomUUID()`.
- Dates/times are stored as ISO 8601 strings in SQLite (TEXT columns).
- `isActive` booleans are stored as `INTEGER` (0/1) in SQLite; normalize with `Boolean()` on read.

### TypeScript / type safety
- HTTP wire types live exclusively in `shared/types.ts`. Do not duplicate them in server or client code.
- No `any` in route handlers. For external input of unknown shape, use `unknown` and narrow explicitly.
- `@shared` alias is resolved by Vite (web-app only). `pc-server` uses NodeNext module resolution and cannot resolve `@shared` at runtime — use relative paths or `import type` there.

### PC Server
- Route files export a named `register*Routes` function following the Fastify plugin pattern.
- `normalizeSubtasks()` exists in both `routes/tasks.ts` (server) and `api.ts` (client) — keep them in sync when changing the subtask shape.
- Never use `getTimezoneOffset()` for date arithmetic. Use `localDateKey()` / `effectiveLocalDate()` from `src/utils/date.ts` (JST fixed at UTC+9).
- Migrations go in `migrations/00N_*.ts` numbered files, registered in `migrations/index.ts`. Never add schema changes inline in `db.ts`.
- Prefer module-level `db.prepare()` for statements executed on every request. In-handler `prepare()` is acceptable for one-off or conditional queries.
- Physical deletes are banned. Use soft delete (`deletedAt`) for all removals.

### React / Web App
- `serverUrl` and `apiKey` are available via `useAppConfig()`. Do not pass them as props.
- Notifications use `useToast()` from `ToastContext`. `alert()` is banned. `window.confirm()` is allowed only where synchronous blocking is genuinely required.
- All duration/time formatting goes in `utils/format.ts`. No inline conversions inside components.
- When a component exceeds ~300 lines, split into child components, hooks (`hooks/use*.ts`), and utilities. Shared state logic across multiple components belongs in `hooks/`.

### Testing
- Pure utility functions (`utils/*.ts`, `*Utils.ts`) are tested directly with Vitest — no mocks needed. Design them without external dependencies.
- SQLite integration tests use an in-memory database (`new Database(':memory:')` + `runMigrations(db)`). Never touch the real `app.sqlite`.
- Test files live alongside their source: `foo.ts` → `foo.test.ts` in the same directory.
- Run `npm test` in each subproject to verify. Manual verification with curl or the web UI supplements but does not replace tests.

## Key Spec References

- Full requirements: `docs/REQUIREMENTS.md`
- Technical spec (data schema, API contracts, phased roadmap): `docs/TECH_SPEC.md`
- Agent operating rules: `.github/copilot-instructions.md`
