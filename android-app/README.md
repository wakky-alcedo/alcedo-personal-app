# Android App Scaffold (Phase1)

This module includes the minimum Android-side sync foundation for Phase1.

## Implemented
- Room task model with `updatedAt`, `version`, `deletedAt`
- Sync status states (`UNSENT`, `SYNCING`, `SYNCED`, `FAILED`, `RETRYING`)
- WorkManager-based one-way sync worker (Android -> PC)
- API client for `POST /api/v1/sync/tasks`
- DataStore-based sync config (`server_url`, `api_key`)
- MainActivity UI to create/list tasks and trigger sync manually
- Task row actions: mark done / soft delete

## Settings

- A settings screen is available from the main UI (`設定`) to change the `server_url` and `api_key` used for synchronization. Changes are persisted via DataStore and used by the sync worker.

## Notes
- Phase1 only supports one-way sync.
- Schema and payload are prepared for future bi-directional sync.

## Manual check flow
1. Start PC server (`pc-server`) with API key.
2. Launch Android app.
3. Enter a title (optional) and tap `タスクを1件追加`.
4. Confirm the task appears in `タスク一覧`.
5. Tap `完了` or `削除` to update local state.
6. Tap `今すぐ同期`.
5. Verify on PC:
	- `GET /api/v1/tasks` returns inserted task rows.

## Current limitations
- No dedicated edit-title/detail screen yet.
- Server URL/API key editor UI is not wired yet.
