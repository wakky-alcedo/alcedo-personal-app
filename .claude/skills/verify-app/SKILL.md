---
description: Verify pc-server and web-app are running correctly by exercising all major API endpoints
---

# Verify App

Checks that both dev servers are up and that core API flows work end-to-end.

## Steps

### 1. Confirm both servers are listening

```powershell
netstat -ano | findstr ":5173 " | findstr LISTENING
netstat -ano | findstr ":8787 " | findstr LISTENING
```

Expected: one line each. If either is missing, run the `run-dev-servers` skill first.

### 2. Web-app responds

```powershell
Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing | Select-Object StatusCode
```

Expected: `200`

### 3. API health — all three resources

```powershell
$h = @{"X-Api-Key"="dev-local-key"}
Invoke-WebRequest -Uri "http://localhost:8787/api/v1/tasks"   -Headers $h -UseBasicParsing | Select-Object StatusCode, @{n="Body";e={$_.Content}}
Invoke-WebRequest -Uri "http://localhost:8787/api/v1/habits"  -Headers $h -UseBasicParsing | Select-Object StatusCode, @{n="Body";e={$_.Content}}
Invoke-WebRequest -Uri "http://localhost:8787/api/v1/beliefs" -Headers $h -UseBasicParsing | Select-Object StatusCode, @{n="Body";e={$_.Content}}
```

Expected: all `200` with `{"tasks":[]}` / `{"habits":[]}` / `{"beliefs":[]}` (empty is fine).

### 4. Auth guard

```powershell
try {
  Invoke-WebRequest -Uri "http://localhost:8787/api/v1/tasks" -UseBasicParsing | Out-Null
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`

### 5. Task round-trip (upsert → read → soft-delete → sync/changes)

> **Important**: always pass body as `[byte[]]` to avoid PowerShell's default encoding mangling Japanese characters.

```powershell
$h = @{"X-Api-Key"="dev-local-key"; "Content-Type"="application/json; charset=utf-8"}
$id = "verify-$(Get-Random)"

# upsert
$upsertBody = [System.Text.Encoding]::UTF8.GetBytes(
  "{`"upserts`":[{`"id`":`"$id`",`"title`":`"動作確認タスク`",`"status`":`"todo`",`"categoryType`":`"short_term`",`"categoryName`":`"test`",`"priority`":`"low`",`"version`":1,`"updatedAt`":`"$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')`"}]}"
)
$r1 = Invoke-WebRequest -Uri "http://localhost:8787/api/v1/sync/tasks" -Method POST -Headers $h -Body $upsertBody -UseBasicParsing
Write-Host "upsert: $($r1.Content)"   # expect acceptedUpserts:1

# read back
$r2 = Invoke-WebRequest -Uri "http://localhost:8787/api/v1/tasks" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing
$r2.Content | ConvertFrom-Json | Select-Object -ExpandProperty tasks | Where-Object id -eq $id

# soft-delete
$delBody = [System.Text.Encoding]::UTF8.GetBytes(
  "{`"deletions`":[{`"id`":`"$id`",`"version`":2,`"updatedAt`":`"$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')`"}]}"
)
$r3 = Invoke-WebRequest -Uri "http://localhost:8787/api/v1/sync/tasks" -Method POST -Headers $h -Body $delBody -UseBasicParsing
Write-Host "delete: $($r3.Content)"   # expect acceptedDeletions:1

# confirm gone from GET /tasks
$r4 = Invoke-WebRequest -Uri "http://localhost:8787/api/v1/tasks" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing
Write-Host "after delete: $($r4.Content)"   # expect tasks:[]

# confirm appears in sync/changes deletions
$since = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$r5 = Invoke-WebRequest -Uri "http://localhost:8787/api/v1/sync/changes?since=$since" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing
Write-Host "sync/changes: $($r5.Content)"   # expect deletions:[{id:$id,...}]
```

### 6. Error cases

```powershell
# Unknown route → 404
try {
  Invoke-WebRequest -Uri "http://localhost:8787/api/v1/notfound" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing | Out-Null
} catch { $_.Exception.Response.StatusCode.value__ }

# sync/changes without `since` → 400
try {
  Invoke-WebRequest -Uri "http://localhost:8787/api/v1/sync/changes" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing | Out-Null
} catch { $_.Exception.Response.StatusCode.value__ }
```

Expected: `404`, `400`

## Pass criteria

| Check | Expected |
|-------|----------|
| Both ports listening | ✅ |
| web-app 200 | ✅ |
| tasks / habits / beliefs 200 | ✅ |
| No API key → 401 | ✅ |
| Task upsert `acceptedUpserts:1` | ✅ |
| Task readable after upsert (Japanese title intact) | ✅ |
| Soft-delete: gone from GET /tasks | ✅ |
| Soft-delete: appears in sync/changes deletions | ✅ |
| Unknown route → 404 | ✅ |
| sync/changes without since → 400 | ✅ |

## Known quirks

- `acceptedUpserts` / `acceptedDeletions` in the response reflect **request item count**, not actual DB write count. A version-conflicted upsert that is silently skipped still increments the counter (`routes/tasks.ts:175`).
- When sending JSON via PowerShell `Invoke-WebRequest`, always use `[System.Text.Encoding]::UTF8.GetBytes(...)` as the body. Passing a plain string defaults to a non-UTF-8 encoding and corrupts multi-byte characters (e.g. Japanese) in SQLite.
