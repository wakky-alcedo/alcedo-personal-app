# 技術仕様

## 1. 目的
本書は，[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) の要求仕様を実装可能な技術仕様へ具体化するための文書である．
対象は Android アプリと PC Web アプリ（ローカル運用）であり，個人利用（単一ユーザー）を前提とする．

## 2. 決定事項（要件からの確定）
1. プラットフォーム
- Android：ネイティブアプリ
- PC：Web アプリ（ローカルネットワーク内で利用）

2. ユーザー/運用
- 単一ユーザー前提
- スマホと PC のデータ同期を行う

3. 通知
- Android のローカル通知（プッシュ通知 UI）を採用
- 通知アクションは「完了」「後で」を提供

4. Obsidian 連携
- Phase2 で実装（当面は後回し）
- スマホ側はバッファ保存と送信要求のみ
- PC側で Obsidian Vault へ追記し，Git commit は PC 側処理として実施

5. セキュリティ
- API キー等は Android Keystore ベースで暗号化保管

## 3. 全体アーキテクチャ
```text
[Android App]
	- 信念/タスク/習慣 UI
	- Obsidian 送信バッファ (Room)
	- UsageStats 収集
	- 通知/ウィジェット
	- 同期クライアント (HTTPS)
					|
					| LAN (HTTPS + API Key)
					v
[PC Local Web Stack]
	- Web UI (ダッシュボード/分析/設定)
	- Local API Server
	- Local DB (SQLite)
	- Obsidian Bridge (Vault追記)
	- Git Bridge (commit)
```

## 4. 技術スタック
### 4.1 Android
- 言語: Kotlin
- UI: Jetpack Compose
- ローカルDB: Room
- バックグラウンド処理: WorkManager
- 設定保存: DataStore
- DI: Hilt
- 通知: NotificationManager + 通知アクション
- ウィジェット: AppWidgetProvider（必要に応じて Glance）
- 連携 API:
	- Shared Intent 受信（ACTION_SEND）
	- UsageStatsManager
	- NFC

### 4.2 PC Web
- フロントエンド: React + TypeScript + Vite
- バックエンド: Node.js (Fastify)
- DB: SQLite (better-sqlite3)
- グラフ表示: Recharts
- 認証: ローカル API キー方式（単一ユーザー前提）

### 4.3 Windows アクティビティトラッカー (win-tracker)
- 言語: C# (.NET 8, Windows Forms)
- ディレクトリ: `win-tracker/`
- 動作: システムトレイ常駐アプリ
- 機能:
  - GetForegroundWindow でアクティブウィンドウを監視
  - UI Automation でブラウザのタブタイトル・URL取得（Chrome/Edge/Firefox/Vivaldi/Brave対応）
  - `appsettings.json` で設定: ServerUrl, ApiKey, DeviceId(=MachineName), SampleIntervalSeconds(15), SyncIntervalMinutes(5)
  - セッション管理: アクティビティが変化した時のみセッションを完結させてバッファ追加（同一内容継続は記録しない）
  - 5分ごとにバッファをサーバーへ一括 POST
  - 終了時にバッファをディスク永続化、次回起動時に再ロード
  - `--diag` フラグ: UI Automation ツリーをファイルダンプする診断モード
  - ディスプレイオフ検知: `GUID_CONSOLE_DISPLAY_STATE` 電源設定通知を受信し、オフ時に現在セッションを終了・サンプリング停止。ディスプレイオフ区間は `category='睡眠'` のセッションとして記録される。記録のないギャップは `'不明'` として表示される。

### 4.3 連携
- Android -> PC: HTTPS REST API
- PC -> Obsidian: Obsidian Local Vault ファイル追記（Phase2）
- PC -> Git: サーバー側で add/commit（push は任意，Phase2）
- 同期方向: Phase1 は Android -> PC の片方向，Phase2以降で PC -> Android を追加して双方向化

## 5. モジュール設計
### 5.1 Android モジュール
1. belief
- 信念 CRUD
- ホーム表示用ランダム抽出
- ウィジェット表示

2. task
- ToDo CRUD
- 優先度/期限
- 短期・長期カテゴリ管理

3. habit
- 習慣定義
- 日次実行ログ
- ストリーク計算
- 習慣通知スケジューラ

4. memo
- Shared Intent 受領（ACTION_SEND / text/plain）
- メモ一覧・作成・編集・削除
- Push/Pull 双方向同期（WorkManager）

5. obsidian_buffer（Phase2）
- Shared Intent 受領
- バッファ編集
- 送信状態管理（未送信/送信中/送信済/失敗/再試行中）

5. telemetry
- UsageStats 収集
- 手動ポモドーロ計測
- 日次集計

6. sync
- NFC/SSID トリガー検知
- PC API 送信
- リトライ/重複防止

### 5.2 PC モジュール
0. shared/ (HTTPワイヤー型)
- `shared/types.ts`: Task, Belief, Habit, AnalyticsEntry など HTTP 経由で交換する型を定義
- `shared/api-errors.ts`: StandardError 型
- pc-server・web-app 双方からインポート可能。DBレイヤー内部型（TaskRow等）は pc-server 側に残す

1. api
- Android 受信用エンドポイント
- Web UI 向け参照エンドポイント

2. obsidian_bridge
- 日付ファイルへ末尾追記
- 追記フォーマット正規化

3. git_bridge
- 変更検知
- commit 実行

4. analytics
- 手動記録 (analytics_daily) と自動記録 (activity_logs) の2系統
- 指標算出（カテゴリ別時間, SNS時間警告）
- 日次/週次/月次集計

5. activity_tracker (win-tracker 連携)
- win-tracker からのセッションデータ受信・保存 (`POST /activity/bulk`)
- セッションベースの分類（activity_rules テーブルの正規表現ルール）
- クロスデバイス引き継ぎ: 別デバイスのオープンセッションを自動クローズ
- 既存ログの一括再分類 (`POST /activity/reclassify`)

6. web_ui
- ダッシュボード：アクティブタブバナー＋信念（コンパクト）＋習慣（クイックチェック＋カレンダーヒートマップ）＋タスク一覧
- 分析：日次（作業記録タイムライン＋手動記録）・週次・月次，デバイスフィルタ
  - 作業時間配分（円グラフ）: `buildSegments` でバケツマージ後、不明・睡眠を除いた実活動カテゴリのみ集計。睡眠は別行「睡眠: Xh」で表示
  - 手動エントリ（startedAt/endedAt付き）はタイムラインを上書き。日付境界をまたぐものは除外（作業配分）/クランプ表示（タイムライン）
  - DEFAULT_COLORS に「睡眠」カテゴリを追加（#93c5fd）
- 設定：サーバー接続＋信念フル管理＋習慣フル管理＋分類ルール管理
- URLハッシュによるタブ状態保持（`#dashboard` / `#analytics` / `#settings`）

## 6. データ仕様
### 6.1 Android (Room)
1. beliefs
- id: UUID
- text: string
- is_active: boolean
- created_at: datetime
- updated_at: datetime

2. tasks
- id: UUID
- title: string
- description: string?
- category_type: enum(short_term, long_term)
- category_name: string
- priority: enum(low, medium, high)
- due_at: datetime?
- due_time: string? (HH:mm, JSTローカル想定)
- status: enum(todo, doing, done)
- created_at, updated_at

3. habits
- id: UUID
- name: string
- notify_time: time?
- widget_priority_time_range_start: time?
- widget_priority_time_range_end: time?
- is_active: boolean

4. habit_logs
- id: UUID
- habit_id: UUID
- done_date: date
- created_at: datetime

5. obsidian_buffer_items
- id: UUID
- source_app: string
- title: string?
- body: text
- tags: string(json)
- status: enum(pending, syncing, retrying, synced, failed)
- dedupe_hash: string
- retry_count: int
- last_error: string?
- created_at, updated_at

6. telemetry_daily
- id: UUID
- target_date: date
- source: enum(android, pc, merged)
- category: string
- duration_sec: int

### 6.2 PC (SQLite)
スキーマ定義: `pc-server/src/migrations/` (番号付きファイルで管理, `db.ts` から `runMigrations()` 呼び出し)

1. tasks
- id: TEXT PRIMARY KEY (UUID)
- title: TEXT NOT NULL
- description: TEXT?
- categoryType: TEXT NOT NULL (short_term | long_term)
- categoryName: TEXT NOT NULL
- priority: TEXT NOT NULL (low | medium | high)
- dueAt: TEXT? (ISO 8601, UTC midnight `YYYY-MM-DDT00:00:00.000Z`)
- dueTime: TEXT? (`HH:mm`, JSTローカル想定。dueAt未設定時はnull)
- status: TEXT NOT NULL (todo | doing | done)
- subtasks: TEXT NOT NULL DEFAULT '[]' (JSON, 再帰的ツリー構造)
- parentId: TEXT? (フラットモデル用, subtasks JSONと共存)
- deletedAt: TEXT? (ソフトデリート用タイムスタンプ)
- updatedAt: TEXT NOT NULL (ISO 8601)
- version: INTEGER NOT NULL (楽観的排他制御用)

2. beliefs
- id: TEXT PRIMARY KEY (UUID)
- text: TEXT NOT NULL
- isActive: INTEGER NOT NULL (0/1)
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL

3. habits
- id: TEXT PRIMARY KEY (UUID)
- name: TEXT NOT NULL
- notifyTime: TEXT?
- widgetPriorityTimeRangeStart: TEXT?
- widgetPriorityTimeRangeEnd: TEXT?
- isActive: INTEGER NOT NULL (0/1)
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL

4. habit_logs
- id: TEXT PRIMARY KEY (UUID)
- habitId: TEXT NOT NULL
- doneDate: TEXT NOT NULL
- createdAt: TEXT NOT NULL
- UNIQUE(habitId, doneDate)

5. analytics_daily
- id: TEXT PRIMARY KEY (UUID)
- targetDate: TEXT NOT NULL
- source: TEXT NOT NULL DEFAULT 'manual'
- category: TEXT NOT NULL
- durationSec: INTEGER NOT NULL DEFAULT 0
- startedAt: TEXT（UTC ISO 8601, NULL=旧形式互換）
- endedAt: TEXT（UTC ISO 8601, NULL=旧形式互換）
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL

制約: startedAt ≤ endedAt。起動時マイグレーションで startedAt > endedAt のレコードは startedAt を 24h 戻して自動修正する（旧 toISO バグ由来データ対策）。

6. activity_logs（win-tracker セッションデータ）
- id: TEXT PRIMARY KEY (UUID, サーバー生成)
- deviceId: TEXT NOT NULL DEFAULT 'unknown'（例: `DELL-XPS`, `Environment.MachineName`）
- startedAt: TEXT NOT NULL（UTC ISO 8601, セッション開始）
- endedAt: TEXT（UTC ISO 8601, NULL = 進行中オープンセッション）
- processName: TEXT NOT NULL
- windowTitle: TEXT NOT NULL（ブラウザはタブタイトル, 他はウィンドウタイトル）
- browserUrl: TEXT（ブラウザのみ, クエリ文字列・フラグメント除去済み）
- category: TEXT NOT NULL DEFAULT '未分類'（activity_rules で自動分類）
- isMediaPlaying: INTEGER NOT NULL DEFAULT 0（メディア再生中フラグ）
- source: TEXT NOT NULL DEFAULT 'win-tracker'
- createdAt: TEXT NOT NULL
- UNIQUE(deviceId, startedAt)

7. activity_rules（自動分類ルール）
- id: TEXT PRIMARY KEY (UUID)
- pattern: TEXT NOT NULL（正規表現）
- field: TEXT NOT NULL DEFAULT 'processName'（'processName' | 'windowTitle' | 'browserUrl'）
- category: TEXT NOT NULL（分類先カテゴリ名）
- priority: INTEGER NOT NULL DEFAULT 0（高い値が優先）
- createdAt, updatedAt: TEXT NOT NULL

8. memos（migration 004）
- id: TEXT PRIMARY KEY (UUID)
- body: TEXT NOT NULL
- source_url: TEXT?（共有元URL）
- source_title: TEXT?（記事タイトル，Intentから取得）
- version: INTEGER NOT NULL（楽観的排他制御）
- created_at: TEXT NOT NULL（時系列ソートキー）
- updated_at: TEXT NOT NULL
- deleted_at: TEXT?（ソフトデリート）
- インデックス: idx_memos_updated(updated_at), idx_memos_created(created_at)

9. sync_inbox (Phase2)
10. obsidian_append_logs (Phase2)
11. git_commit_logs (Phase2)

## 7. API 仕様（PC Local API）
### 7.1 認証
- ヘッダ `X-Api-Key` 必須
- APIキー不一致時は 401

### 7.2 エンドポイント
#### タスク (実装済み: `pc-server/src/routes/tasks.ts`)
1. POST /api/v1/sync/tasks
- 用途: タスクのupsert/削除（Android同期・Web UI共通）
- Request: { tasks?: UpsertTaskInput[], deletions?: DeleteTaskInput[] }
- 競合解決: version-based（incoming.version > stored.version のみ受理）
- Response: { acceptedUpserts, acceptedDeletions }

2. GET /api/v1/tasks
- 用途: 全タスク取得（deletedAt IS NULL のみ）
- Query: since? (差分取得用 updatedAt フィルタ)
- Response: { tasks: Task[] }（parentIdによるツリー構築済み）

3. GET /api/v1/sync/changes?since=ISO8601
- 用途: 差分同期（Android用）
- Response: { upserts: Task[], deletions: {id, deletedAt}[] }

#### 信念 (実装済み: `pc-server/src/routes/beliefs.ts`)
4. GET /api/v1/beliefs — 一覧取得
5. POST /api/v1/beliefs — 作成
6. PUT /api/v1/beliefs/:id — 更新
7. DELETE /api/v1/beliefs/:id — 削除

#### 習慣 (実装済み: `pc-server/src/routes/habits.ts`)
8. GET /api/v1/habits — 一覧取得（streak・completedToday はクエリ時計算）
9. POST /api/v1/habits — 作成・更新（id 指定で upsert）
10. DELETE /api/v1/habits/:id — 削除（habit_logs も削除）
11. POST /api/v1/habits/:id/logs — 日次チェックイン
- Body: `{ doneDate?: string }` (省略時は当日)
- UNIQUE(habitId, doneDate) で二重チェックイン防止
12. GET /api/v1/habits/logs?from=YYYY-MM-DD&to=YYYY-MM-DD — ログ一覧取得
- 用途: 習慣カレンダーヒートマップ表示用
- Response: `[{ habitId, doneDate }]`

#### リアルタイム通知 (実装済み: `pc-server/src/routes/events.ts`)
13. GET /api/v1/events — SSE (Server-Sent Events)
- 用途: タスク変更のリアルタイム通知
- クライアントはこのイベントで差分取得を行う

#### アクティビティ追跡 (実装済み: `pc-server/src/routes/activity.ts`)
14. POST /api/v1/activity/bulk — win-tracker からセッションを一括受信
- Body: `{ deviceId: string, logs: Session[] }`
- Session: `{ startedAt, endedAt?, processName, windowTitle, browserUrl?, isMediaPlaying? }`
- 挿入時に activity_rules で自動分類
- endedAt=null のセッションが含まれる場合: 他デバイスのオープンセッションを同タイムスタンプで自動クローズ（クロスデバイス引き継ぎ）
- UPSERT: UNIQUE(deviceId, startedAt) に競合時は endedAt を更新（クローズ済みセッションは再オープンしない）

15. GET /api/v1/activity/current — 最新セッション1件取得
- オープンセッション（endedAt IS NULL）を優先返却
- 用途: ダッシュボードの ActiveTabBanner

16. GET /api/v1/activity/logs?date=YYYY-MM-DD&deviceId=xxx — 日次セッション一覧
17. GET /api/v1/activity/summary?date=YYYY-MM-DD&deviceId=xxx — カテゴリ別実測時間集計
- 時間計算: `(julianday(COALESCE(endedAt, now)) - julianday(startedAt)) * 86400`

18. GET /api/v1/activity/devices?date=YYYY-MM-DD — デバイスID一覧
- `date` 省略時: 全期間の記録済みデバイス。指定時: その日に活動があったデバイスのみ返す
- 用途: 分析ページのデバイスフィルタ（当日未使用のデバイスを非表示）

19. POST /api/v1/activity/logs/:id/category — カテゴリ手動修正

20. GET /api/v1/activity/rules — 分類ルール一覧
21. POST /api/v1/activity/rules — 分類ルール作成・更新（id 指定で upsert）
22. DELETE /api/v1/activity/rules/:id — ルール削除

23. POST /api/v1/activity/rules/import — 分類ルールと色設定を一括インポート
- Body: `{ rules: RuleInput[], categories?: Record<string, string>, mode?: "replace" | "merge" }`
- `mode=replace`（デフォルト）: 既存ルールを全削除してから挿入。`merge`: 追加のみ
- カテゴリ色（`categories`）はクライアント localStorage に保存されるためサーバーには保存しない
- エクスポート形式: `{ rules:[...], categories:{...} }`（設定画面 → エクスポートボタン）

24. POST /api/v1/activity/reclassify — 全既存ログを現在のルールで再分類
- 用途: ルール変更後に過去ログへ遡及適用

#### メモ (実装済み: `pc-server/src/routes/memos.ts`)
24. GET /api/v1/memos?since=ISO8601&limit=50&cursor=updatedAt
- 用途: 一覧取得（since省略時は全件，指定時はPull差分取得）
- 競合解決: version-based（Taskと同方式）
- Response: { memos: Memo[], nextCursor: string | null }

25. POST /api/v1/sync/memos
- 用途: Android → PC Push upsert/削除
- Request: { upserts?: MemoInput[], deletions?: {id}[] }
- 競合解決: incoming.version > stored.version のみ上書き（同versionはupdatedAt比較）

26. PATCH /api/v1/memos/:id
- 用途: Web App からの本文編集
- Request: { body: string }
- Response: { memo: Memo }

27. DELETE /api/v1/memos/:id — ソフトデリート（deletedAt セット）

#### Obsidian連携 (Phase2)
28. POST /api/v1/sync/obsidian-buffer
- 用途: Android バッファ一括送信
- Request: items[]（mobile_item_id, title, body, tags, created_at, dedupe_hash）
- Response: accepted_ids[], rejected_ids[]

25. POST /api/v1/sync/trigger
- 用途: NFC/SSID トリガー送信開始

#### 分析 (実装済み: `pc-server/src/routes/analytics.ts`)
26. GET /api/v1/analytics/daily?date=YYYY-MM-DD — 日次分析取得（手動記録）
27. POST /api/v1/analytics/daily — 手動記録追加
28. DELETE /api/v1/analytics/daily/:id — 手動記録削除
29. GET /api/v1/analytics/summary?range=weekly|monthly&anchor=YYYY-MM-DD — 集計グラフ表示

## 8. Obsidian/Git 連携仕様
1. 追記先ファイル
- `${vault}/Daily/YYYY-MM-DD.md`

2. 追記フォーマット
```markdown
## Inbox from Mobile
- [2026-04-14 21:05] title
	- body
	- tags: #tag1 #tag2
	- id: <mobile_item_id>
```

3. 重複防止
- `mobile_item_id` または `dedupe_hash` を PC 側で保存
- 既処理IDは再追記しない

4. Git commit
- 追記成功時のみ `git add` + `git commit`
- commit message: `mobile-sync: YYYY-MM-DD HH:mm` 

## 9. 同期/リトライ仕様
### 9.1 タスク同期（version-based）
- Upsert: incoming.version > stored.version の場合のみ上書き（同一versionならupdatedAt比較）
- 削除: ソフトデリート（deletedAt タイムスタンプ）で同期安全性を確保
- サーバーは変更時に SSE で `tasks-changed` をブロードキャスト

### 9.2 Web UI クライアント同期
- 楽観的更新: 保存時にローカルstateを即時更新し，APIエラー時のみロールバック（`App.tsx` handleSave/handleDelete）
- バックグラウンド同期: EventSource (SSE) で `tasks-changed` を受信し `getTasks()` で最新化（フルリフレッシュせずスクロール位置を維持）
- 初回ロードのみ loading 表示．既にタスクが表示されている場合は loading でDOMを破棄しない

### 9.3 Android 送信
- 送信は WorkManager で実行
- Backoff: exponential
- 最大再試行回数: 5

### 9.4 失敗分類
- 4xx: 永続失敗（failed）
- 5xx/タイムアウト: 再試行
- ネットワーク不可: 接続復帰待ち再試行

### 9.5 一貫性
- Android 側はサーバー受理応答後に synced 化
- 中断時は idempotent に再送

## 10. 通知仕様
1. タスク期限通知
- 期限の 30 分前（デフォルト）

2. 習慣通知
- 習慣ごとに通知時刻設定
- アクション: 完了 / 後で（10分スヌーズ）

3. 通知制御
- ユーザー設定で全体ON/OFF

4. Web UI タスク期限通知（実装済み: `web-app/src/hooks/useDueTaskNotifications.ts`）
- 対象: `dueAt`・`dueTime` 両方設定済み、`status !== 'done'`、未削除のタスク
- タイミング: 期限が `(now, now + reminderMinutes]` の範囲に入った時点で1回のみ（期限切れタスクは対象外）
- 通知方法: ブラウザ Notification API が許可済みならOS通知、未許可/拒否時はアプリ内トースト (`toast.info`) にフォールバック
- 設定: 全体ON/OFF（デフォルトOFF）、`reminderMinutes`（デフォルト30分）。いずれも `localStorage` に保存（`contexts/NotificationSettingsContext.tsx`）
- チェック間隔: 60秒。通知済みタスクは `localStorage`（`alcedo_notif_notified_keys`）にキー（`taskId:dueAt:dueTime`）を記録し再通知を防止。期限編集で再通知される

## 11. ウィジェット仕様
1. 表示内容
- 信念ランダム1件
- 習慣クイックチェック最大3件

2. 更新
- 30分周期更新 + 手動更新

3. 操作
- 習慣タップで完了記録

## 12. 分析指標
### 12.1 自動計測（activity_logs）
- win-tracker がセッションベースで収集（変化時のみ記録）
- カテゴリ: 開発/ブラウザ/コミュニケーション/学習/SNS/娯楽/未分類（デフォルト）
- 分類ルール: activity_rules テーブルの正規表現（processName / windowTitle / browserUrl で照合, priority 降順）
- デフォルトルール (`rules.json`): youtube/Netflix/Twitch→娯楽, twitter→SNS, github/stackoverflow→開発, Discord/Slack→コミュニケーション, Obsidian/Anki→学習
- デバイスフィルタ: deviceId ごとに集計可能, 全デバイス合算も可

### 12.2 手動記録（analytics_daily）
- Web UI から開始時刻・終了時刻・カテゴリを入力して記録。durationSec はサーバー側で自動計算。
- startedAt/endedAt を持つエントリはタイムライン上で自動ログを上書きする（手動が優先）。
- 日付境界（6am）をまたぐエントリ（例: 03:00〜10:00）：
  - DayTimeline: dayStart でクランプして表示
  - 作業時間配分: 除外（startedAt < dayStart の場合）
- 睡眠（category='睡眠'）：当日 effective day 内に終わるセッションの durationSec を合算して「睡眠: Xh」表示。cross-boundary 分も含む。
- SNS使用時間 >= 60分/日 で警告表示
- 手動記録のインライン編集・削除が可能（AnalyticsEntryEditRow）

### 12.3 レポート単位
- 日次: タイムライン表示 + カテゴリ円グラフ（自動）, 手動記録一覧
- 週次/月次: カテゴリ別積み上げ棒グラフ

### 12.4 習慣カレンダー
- 過去60日分を習慣ごとに横1行のヒートマップ表示
- 達成日=緑, 未達成=グレー, 今日=青枠
- ダッシュボードの Habits セクションに統合

## 13. セキュリティ仕様
1. Android
- APIキーを Android Keystore ベースで暗号化保管
- 機微データを外部ストレージへ保存しない

2. 通信
- HTTPS 必須
- PC 側証明書を自己署名で運用する場合はピンニング対応を検討対象

3. ログ
- APIキー，認証情報，個人識別情報をログ出力しない

## 14. 非機能要件への対応
1. 起動3秒以内
- Android: 初期表示データを Room キャッシュから即時描画
- 重い処理は起動後非同期

2. Obsidian送信5秒以内
- 受信APIは先に inbox へ永続化して即時応答
- 実追記と commit は非同期ワーカー処理

3. 可用性
- PC 停止中は Android 側にバッファ保持し再送

## 15. リリース段階
### Phase 1 (MVP) ✅ 実装済み
- 信念の表示と編集（ダッシュボードにコンパクト表示，設定でフル管理）
- タスクのCRUD＋サブタスクツリー＋ステータス/優先度フィルタ＋期限色分け＋インライン編集
- 習慣の記録とストリーク表示（ダッシュボードにクイックチェック＋60日ヒートマップ統合，設定でフル管理）
- タスクの同期（Android -> PC の片方向・最小構成，version-based 競合解決）
- Web UI の楽観的更新＋SSEリアルタイム通知
- URLハッシュによるタブ状態保持
- **win-tracker (Windows)**: アクティブウィンドウ・ブラウザタブタイトル/URLを自動記録（セッションモデル）
- **マルチデバイス対応**: deviceId によるデバイス識別，クロスデバイス引き継ぎ（別デバイスがアクティブになったら前デバイスのセッションを自動クローズ）
- **分析タイムライン**: カテゴリ別時間配分, デバイスフィルタ, 分類ルール管理（正規表現），既存ログ再分類
- **ActiveTabBanner**: ダッシュボード上部に現在のアクティブウィンドウ/タブをリアルタイム表示
- **Android 分析画面**: 使用時間（UsageStatsManager によるアプリ別・カテゴリ別集計）／PC活動（`GET /api/v1/activity/summary` からカテゴリ別時間取得）／習慣達成率（過去30日完了率）の3タブ。`PACKAGE_USAGE_STATS` 特別アクセス許可が必要。
- **Android → PC 使用時間同期**: `UsageEvents.queryEvents()` でフォアグラウンド/バックグラウンドイベントから近似セッションを生成し、`POST /api/v1/activity/bulk`（`deviceId = Build.MODEL`）で activity_logs に統合保存。WorkManager で毎日深夜2時に自動実行。web-app のデバイスフィルタでスマホのデータを個別確認可能。

### Phase 2
- 日次ダッシュボード
- 週次/月次分析強化
- 日次レポートと目標達成率
- タスク同期の双方向化（PC -> Android 追加，競合解決を導入）

### Phase2.5
- Shared Intent -> バッファ -> PC同期 -> Obsidian追記 -> Git commit
- Google カレンダー / Google マップ / HomeAssistant 連携

### Phase 3
- X 投稿代行

## 16. 既知の未確定事項
0. Obsidian連携の完了定義（PC受信ACKまで / Vault追記完了まで / Git commit完了まで）は後回し
0.5 双方向同期時の競合解決ポリシー（last-write-wins / version-based merge / manual resolve）の確定
1. Google マップ履歴連携方式（公式API制約の精査が必要）
2. HomeAssistant 連携方法（Webhook/API token運用方針）
3. Service Worker による Web Push 採用有無（タブを閉じている間も通知したい場合に必要。現状は §10-4 の通り、タブを開いている間のみのNotification API/トースト通知で対応済み）
4. X投稿代行のMVPでの表示/非表示方針（後回し）

## 17. 公式リファレンス
1. Android App Widgets
- https://developer.android.com/develop/ui/views/appwidgets

2. UsageStatsManager
- https://developer.android.com/reference/android/app/usage/UsageStatsManager

3. WorkManager
- https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started

4. NFC
- https://developer.android.com/develop/connectivity/nfc

5. Intent / Shared Intent
- https://developer.android.com/guide/components/intents-filters

6. Room
- https://developer.android.com/training/data-storage/room

7. Android Keystore
- https://developer.android.com/privacy-and-security/keystore

8. Android Security Tips
- https://developer.android.com/topic/security/data

9. DataStore
- https://developer.android.com/topic/libraries/architecture/datastore

10. Web Push API
- https://developer.mozilla.org/en-US/docs/Web/API/Push_API






