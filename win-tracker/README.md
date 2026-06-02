# WinTracker — Windows 作業記録アプリ

フォアグラウンドウィンドウを15秒ごとに記録し、pc-serverへ自動同期するシステムトレイ常駐アプリ。

## 前提条件

- .NET 8 SDK（`winget install Microsoft.DotNet.SDK.8`）
- pc-server が起動済み（デフォルト: `http://localhost:8787`）

## ビルド・実行

```powershell
cd win-tracker
dotnet build
dotnet run
```

タスクトレイにアイコンが表示されれば起動成功。

## リリースビルド（単体実行ファイル）

```powershell
dotnet publish -c Release -r win-x64 --self-contained -o publish
```

`publish/WinTracker.exe` を任意の場所に配置して実行。

## トレイメニュー操作

| メニュー | 動作 |
|---------|------|
| 今すぐ同期 | バッファ内の記録を即座にサーバーへ送信 |
| 一時停止 / 再開 | 記録の一時停止・再開を切り替え |
| 終了 | バッファをディスクに保存して終了（次回起動時に再送信） |

## 設定ファイル

### appsettings.json

```json
{
  "ServerUrl": "http://localhost:8787",
  "ApiKey": "dev-local-key",
  "SampleIntervalSeconds": 15,
  "SyncIntervalMinutes": 5
}
```

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| ServerUrl | pc-serverのURL | `http://localhost:8787` |
| ApiKey | API認証キー | `dev-local-key` |
| SampleIntervalSeconds | フォアグラウンド取得間隔（秒） | 15 |
| SyncIntervalMinutes | サーバー同期間隔（分） | 5 |

### rules.json

自動分類ルール。上から順に評価し、最初にマッチしたカテゴリを適用する。

```json
[
  { "pattern": "devenv|Code|rider|idea64", "field": "processName", "category": "開発" },
  { "pattern": "chrome|firefox|msedge", "field": "processName", "category": "ブラウザ" },
  { "pattern": "YouTube|Netflix", "field": "windowTitle", "category": "娯楽" }
]
```

| フィールド | 説明 |
|-----------|------|
| pattern | 正規表現（大文字小文字区別なし） |
| field | マッチ対象: `processName` または `windowTitle` |
| category | 割り当てるカテゴリ名 |

ルールにマッチしない場合は「未分類」になる。Web UIの設定画面からもルールを管理可能。

## 記録の確認

ブラウザで `http://localhost:5173` を開き、「分析」タブ → 「作業記録」で確認。

## データフロー

```
WinTracker (15秒ごとに記録)
  → メモリバッファに蓄積
  → 5分ごとに POST /api/v1/activity/bulk で送信
  → pc-server がルールで自動分類して SQLite に保存
  → web-app で タイムライン・円グラフ表示
```

## Windows 起動時に自動実行

タスクスケジューラまたはスタートアップフォルダに登録:

```powershell
# スタートアップフォルダにショートカットを作成
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\WinTracker.lnk")
$shortcut.TargetPath = "$PWD\publish\WinTracker.exe"
$shortcut.WorkingDirectory = "$PWD\publish"
$shortcut.Save()
```
