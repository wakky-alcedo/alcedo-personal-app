---
description: Launch pc-server (Fastify/SQLite on :8787) and web-app (Vite React on :5173) dev servers for local development
---

# Run Dev Servers

Launches both the pc-server and web-app in separate PowerShell windows, then verifies each is responding.

## Prerequisites

`.env` must exist at the repo root. If it doesn't, create it from the example:

```powershell
Copy-Item .env.example .env
```

Install dependencies (only needed once, or after `npm install` changes):

```powershell
cd pc-server; npm install; cd ..
cd web-app;   npm install; cd ..
```

## Launch

Start both servers in separate terminal windows (they block, so each needs its own window):

```powershell
# pc-server (port 8787)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\user_file\AlcedoApp\alcedo-personal-app\pc-server'; $env:API_KEY='dev-local-key'; npm run dev" -WindowStyle Normal

# web-app (port 5173)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\user_file\AlcedoApp\alcedo-personal-app\web-app'; npm run dev" -WindowStyle Normal
```

## Verify

Poll until both are up (allow ~15 seconds):

```powershell
# pc-server
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:8787/api/v1/tasks" -Headers @{"X-Api-Key"="dev-local-key"} -UseBasicParsing -TimeoutSec 2 | Out-Null
    Write-Host "pc-server OK"; break
  } catch { Start-Sleep -Seconds 1 }
}

# web-app
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Write-Host "web-app OK"; break
  } catch { Start-Sleep -Seconds 1 }
}
```

Quick API smoke test (bash/curl):

```bash
curl -H "X-Api-Key: dev-local-key" http://localhost:8787/api/v1/tasks
```

## Other commands

### pc-server

```powershell
cd pc-server
npm run build   # compile TypeScript → dist/
npm start       # run compiled output (production)
```

### web-app

```powershell
cd web-app
npm run build    # production build
npm run preview  # preview production build
```

## Endpoints

| Service   | URL                          | Auth header                    |
|-----------|------------------------------|--------------------------------|
| pc-server | http://localhost:8787         | `X-Api-Key: dev-local-key`     |
| web-app   | http://localhost:5173         | none                           |

## Stop

Close the PowerShell windows, or kill by port:

```powershell
# pc-server
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8787 -State Listen).OwningProcess -Force

# web-app
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173 -State Listen).OwningProcess -Force
```

## Environment

| Variable          | Required | Default         | Notes                                          |
|-------------------|----------|-----------------|------------------------------------------------|
| `API_KEY`         | Yes      | `dev-local-key` | All API requests require `X-Api-Key` header    |
| `PORT`            | No       | `8787`          | pc-server listen port                          |
| `VITE_SERVER_URL` | No       | `http://localhost:8787` | web-app backend URL override        |
