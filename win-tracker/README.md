# WinTracker — Windows 作業記録アプリ

フォアグラウンドウィンドウを監視し、アクティビティが変化したときにセッションとして記録して pc-server へ自動同期するシステムトレイ常駐アプリ。ブラウザはUI Automationでタブタイトル・URLも取得する。

## 前提条件（開発時）

- .NET 8 SDK（`winget install Microsoft.DotNet.SDK.8`）
- pc-server が起動済み（デフォルト: `http://localhost:8787`）

リリースビルド（self-contained）は .NET ランタイムが不要。

## ビルド・実行（開発）

```powershell
cd win-tracker
dotnet build -c Release
dotnet run -c Release
```

タスクトレイにアイコンが表示されれば起動成功。

## リリースビルド（配布用・.NET不要）

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

`publish/` フォルダを任意の場所（例: `C:\Apps\WinTracker\`）にコピーして `WinTracker.exe` を実行。

## 設定ファイル

### 設定の場所（優先順位）

| 優先度 | パス | 用途 |
|--------|------|------|
| 高 | `%APPDATA%\WinTracker\appsettings.json` | **ユーザー設定（ここを編集する）** |
| 低 | EXEと同じフォルダの `appsettings.json` | 初回起動時のデフォルト値 |

**初回起動時** に EXE 隣の `appsettings.json` を読み込み、`%APPDATA%\WinTracker\` へ自動コピーします。以降はそちらが読み込まれるため、アプリを更新（EXEを置き換え）しても設定は消えません。

エクスプローラーで開くには: `Win+R` → `%APPDATA%\WinTracker`

### appsettings.json

```json
{
  "ServerUrl": "http://192.168.1.x:8787",
  "ApiKey": "your-api-key",
  "DeviceId": "",
  "SampleIntervalSeconds": 15,
  "SyncIntervalMinutes": 5
}
```

| 項目 | 説明 | デフォルト |
|------|------|-----------|
| ServerUrl | pc-serverのURL | `http://localhost:8787` |
| ApiKey | API認証キー（pc-serverの `API_KEY` と一致させる） | `dev-local-key` |
| DeviceId | デバイス識別名（空欄 = PCのホスト名を自動使用） | `""` |
| SampleIntervalSeconds | アクティビティチェック間隔（秒） | `15` |
| SyncIntervalMinutes | サーバー同期間隔（分） | `5` |

### rules.json

自動分類ルール。`priority` 降順で評価し、最初にマッチしたカテゴリを適用する。Web UIの設定画面からも管理可能（変更はDBに保存され、こちらのファイルより優先される）。

```json
[
  { "pattern": "youtube\\.com", "field": "browserUrl", "category": "娯楽" },
  { "pattern": "github\\.com", "field": "browserUrl", "category": "開発" },
  { "pattern": "twitter\\.com|x\\.com", "field": "browserUrl", "category": "SNS" },
  { "pattern": "devenv|Code|rider", "field": "processName", "category": "開発" },
  { "pattern": "Discord|Slack", "field": "processName", "category": "コミュニケーション" }
]
```

| フィールド | 説明 |
|-----------|------|
| pattern | 正規表現（大文字小文字区別なし） |
| field | マッチ対象: `processName` / `windowTitle` / `browserUrl` |
| category | 割り当てるカテゴリ名 |

## トレイメニュー操作

| メニュー | 動作 |
|---------|------|
| 今すぐ同期 | バッファ内の記録を即座にサーバーへ送信 |
| 一時停止 / 再開 | 記録の一時停止・再開を切り替え |
| 終了 | バッファをディスクに保存して終了（次回起動時に再送信） |

## データフロー

```
WinTracker（15秒ごとにアクティビティをチェック）
  → 前回と同じ内容なら継続（記録しない）
  → 変化があればセッション完結 → バッファに追加
  → 5分ごとに POST /api/v1/activity/bulk で送信
      ├─ deviceId（PCのホスト名）付きで送信
      ├─ 別デバイスのオープンセッションを自動クローズ（作業がこのPCに移ったと判断）
      └─ pc-server がルールで自動分類して SQLite に保存
  → web-app でタイムライン・円グラフ表示
```

## 診断モード

UI Automationツリーのダンプ（ブラウザのタブタイトル取得デバッグ用）:

```powershell
.\WinTracker.exe --diag
```

5秒後にフォアグラウンドウィンドウを取得し、`diag.txt` に出力する。

## Windows 起動時に自動実行

スタートアップフォルダにショートカットを作成:

```powershell
$exe = "C:\Apps\WinTracker\WinTracker.exe"   # 実際のパスに変更
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\WinTracker.lnk")
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = Split-Path $exe
$shortcut.Save()
```
