# PC Sync Server (Phase1)

Phase1 minimum implementation for task sync.

## Scope
- Android -> PC one-way task sync
- API key auth using `X-Api-Key`
- SQLite persistence
- Data model includes `updatedAt` and `version` for future bi-directional sync

## Run
1. Install deps
   - `npm install`
2. Start dev server
   - `API_KEY=dev-local-key npm run dev`
3. Server URL
   - `http://localhost:8787`

## Endpoints
- `POST /api/v1/sync/tasks`
- `GET /api/v1/tasks`
- `GET /api/v1/sync/changes?since=<ISO8601>`

## Quick verify
```bash
curl -H "X-Api-Key: dev-local-key" http://localhost:8787/api/v1/tasks
```

## Sync payload
`POST /api/v1/sync/tasks` accepts either:

1. Backward-compatible form
```json
{ "tasks": [ ... ] }
```

2. Forward-compatible form (recommended)
```json
{
   "upserts": [ ... ],
   "deletions": [
      { "id": "task-id", "updatedAt": "2026-04-14T12:00:00Z", "version": 3 }
   ]
}
```

Deletes are stored as tombstones (`deletedAt`) to support future bi-directional sync safely.
