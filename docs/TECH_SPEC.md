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

4. obsidian_buffer
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
- Android/PC 時間データ統合
- 指標算出（学習比率，SNS時間など）

5. web_ui
- ダッシュボード：信念（コンパクト）＋習慣クイックチェック（コンパクト）＋タスク一覧（フィルタ・ソート・インライン編集・期限色分け）
- 分析レポート（日次/週次/月次）
- 設定画面：サーバー接続設定＋信念フル管理＋習慣フル管理

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
スキーマ定義: `pc-server/src/db.ts`

1. tasks
- id: TEXT PRIMARY KEY (UUID)
- title: TEXT NOT NULL
- description: TEXT?
- categoryType: TEXT NOT NULL (short_term | long_term)
- categoryName: TEXT NOT NULL
- priority: TEXT NOT NULL (low | medium | high)
- dueAt: TEXT? (ISO 8601, UTC midnight `YYYY-MM-DDT00:00:00.000Z`)
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
- createdAt: TEXT NOT NULL
- updatedAt: TEXT NOT NULL

6. sync_inbox (Phase2)
7. obsidian_append_logs (Phase2)
8. git_commit_logs (Phase2)

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
9. POST /api/v1/habits — 作成
10. PUT /api/v1/habits/:id — 更新
11. DELETE /api/v1/habits/:id — 削除
12. POST /api/v1/habits/:id/check-in — 日次チェックイン

#### リアルタイム通知 (実装済み: `pc-server/src/routes/events.ts`)
13. GET /api/v1/events — SSE (Server-Sent Events)
- 用途: タスク変更のリアルタイム通知
- クライアントはこのイベントで差分取得を行う

#### Obsidian連携 (Phase2)
14. POST /api/v1/sync/obsidian-buffer
- 用途: Android バッファ一括送信
- Request: items[]（mobile_item_id, title, body, tags, created_at, dedupe_hash）
- Response: accepted_ids[], rejected_ids[]

15. POST /api/v1/sync/trigger
- 用途: NFC/SSID トリガー送信開始

#### 分析 (実装済み: `pc-server/src/routes/analytics.ts`)
16. GET /api/v1/analytics/daily?date=YYYY-MM-DD — 日次分析取得
17. GET /api/v1/analytics/summary?range=daily|weekly|monthly — 集計グラフ表示

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

## 11. ウィジェット仕様
1. 表示内容
- 信念ランダム1件
- 習慣クイックチェック最大3件

2. 更新
- 30分周期更新 + 手動更新

3. 操作
- 習慣タップで完了記録

## 12. 分析指標
1. 基本指標
- 学習時間
- SNS時間
- 娯楽時間
- 移動時間
- 睡眠推定時間

2. 警告ルール（初期値）
- SNS使用時間 >= 60分/日 で警告

3. レポート単位
- 週次/月次（日次と目標達成率は Phase2 で追加）

4. カテゴリ設計
- 初期テンプレート（学習/SNS/娯楽/移動/その他）を提供
- 一部カテゴリ名とマッピングをユーザー編集可能

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
### Phase 1 (MVP)
- 信念の表示と編集（ダッシュボードにコンパクト表示，設定でフル管理）
- タスクのCRUD＋サブタスクツリー＋ステータス/優先度フィルタ＋期限色分け＋インライン編集
- 習慣の記録とストリーク表示（ダッシュボードにコンパクト表示，設定でフル管理）
- タスクの同期（Android -> PC の片方向・最小構成，version-based 競合解決）
- Web UI の楽観的更新＋SSEリアルタイム通知

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
3. Web Push 採用有無（PC Webの通知設計）
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






