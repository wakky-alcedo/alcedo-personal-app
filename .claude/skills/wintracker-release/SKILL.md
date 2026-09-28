---
description: Build a standalone, self-contained WinTracker.exe (win-tracker/) that runs on any Windows PC without installing .NET, and cleans up unneeded companion files from the output
---

# WinTracker Release Build

Publishes `win-tracker/` as a single self-contained `.exe` that can be copied to
any Windows PC and run directly — no .NET runtime install required.

## Build command

```powershell
cd win-tracker
Remove-Item -Recurse -Force ./publish -ErrorAction SilentlyContinue
dotnet publish -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
  -o ./publish
```

Output: `win-tracker/publish/WinTracker.exe` (~180MB, .NET runtime embedded).

## Clean up the output — exe only

`dotnet publish` also copies `appsettings.json`, `rules.json`, `app.ico`, and
`WinTracker.pdb` into `publish/` because they're `<Content>` items in
`WinTracker.csproj`. **None of these are required at runtime** — the app
falls back gracefully when they're missing:

- `appsettings.json` missing → `Program.cs` uses built-in defaults
  (`ServerUrl=http://localhost:8787`, `ApiKey=dev-local-key`) and writes them
  to `%APPDATA%\WinTracker\appsettings.json` on first run. The tray "設定"
  dialog can edit/save from there without needing the file next to the exe.
- `rules.json` missing → `RuleClassifier` runs with an empty rule set
  (activities show as "未分類" until rules are added via the settings/Web UI).
- `app.ico` missing → falls back to `SystemIcons.Application`.

So delete the companions and keep only the exe:

```powershell
Remove-Item win-tracker/publish/appsettings.json, win-tracker/publish/rules.json, `
  win-tracker/publish/app.ico, win-tracker/publish/WinTracker.pdb -ErrorAction SilentlyContinue
```

Result: `win-tracker/publish/WinTracker.exe` is the only file — copy it
anywhere and run it standalone.

## Replacing a running install

1. Ask the user to quit WinTracker from the tray menu "終了" — never
   `Stop-Process` it: the tray exit flushes unsent logs to `buffer.json` next
   to the exe, and the next launch reloads them.
2. Copy the new `WinTracker.exe` over the old one and start it.
3. Remove stale self-extraction folders. `WinTracker.csproj` sets
   `IncludeAllContentForSelfExtract=true`, so each distinct exe build extracts
   ~170MB into `%TEMP%\.net\WinTracker\<hash>\` on first launch, and old
   builds' folders are never cleaned up. After the new exe is running, delete
   every folder except the one it has loaded:

```powershell
$root = "$env:TEMP\.net\WinTracker"
$inUse = (Get-Process WinTracker).Modules |
  Where-Object FileName -like "$root\*" |
  ForEach-Object { $_.FileName.Substring($root.Length + 1).Split('\')[0] } |
  Select-Object -Unique
Get-ChildItem $root -Directory | Where-Object Name -notin $inUse |
  Remove-Item -Recurse -Force
```

## When to include appsettings.json anyway

If the target PC needs a non-default `ServerUrl`/`ApiKey` and you don't want
to configure it via the tray settings dialog after first launch, copy
`appsettings.json` alongside the exe (before first run) instead of deleting it.
