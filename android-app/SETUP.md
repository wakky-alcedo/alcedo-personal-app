# Android 開発環境セットアップ

エミュレータ・実機でのビルド・実行手順（Windows 開発者向け）。

## 前提

- Android Studio インストール済み
- `adb` がパスにあること（Android Studio が自動導入）

---

## エミュレータ（AVD）

1. Android Studio → `Device Manager` → `Create Virtual Device`
2. 推奨: Google APIs イメージ、Android 11 以上
3. AVD を起動

**サーバー接続**: エミュレータからホストの `localhost` へは `http://10.0.2.2:8787` を使う（`SyncConfig` のデフォルト値が設定済み）。

---

## 実機インストール（Android Studio 経由）

### 1. スマホの準備

1. **開発者オプションを有効化**
   - 設定 → 端末情報 → ビルド番号を **7回連続タップ**
   - 「開発者になりました」と表示されれば成功

2. **USB デバッグを有効化**
   - 設定 → 開発者オプション → USB デバッグ **ON**

### 2. PC と接続

1. USBケーブルでスマホとPCを接続
2. スマホ側に「ファイル転送モード」の選択肢が出た場合は **「ファイル転送（MTP）」** を選択
3. スマホに **「このPCを信頼しますか？」** と出たら **「許可」** をタップ
4. Android Studio 上部のデバイスプルダウンに端末名が表示されることを確認

### 3. インストール・実行

Android Studio の **▶ Run ボタン** を押すだけでビルド→インストール→起動まで自動で行われる。

または PowerShell から:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android-app
.\gradlew installDebug
```

### 4. アプリの初期設定

初回起動後、**設定タブ** から以下を入力:

| 項目 | 値 |
|---|---|
| Server URL | `http://192.168.x.x:8787`（PC の LAN IP） |
| API Key | `dev-local-key` |

PC の LAN IP は PowerShell で確認できる:
```powershell
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
```

PC 側でポート 8787 のファイアウォール許可が必要な場合あり。

---

## ビルド・インストール

```powershell
# デバッグ APK をビルド
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android-app
.\gradlew assembleDebug

# 接続中のデバイスに直接インストール
.\gradlew installDebug
```

または Android Studio の ▶ Run ボタンでデプロイ。

---

## デバッグ

```powershell
# 同期関連ログを絞り込み
adb logcat | Select-String "TaskSyncWorker|WorkManager|UsageStats"

# ログをファイルに保存
adb logcat -d > adb_log.txt
```

WorkManager がすぐに起動しない場合の強制トリガー:

```bash
adb shell cmd jobscheduler run -f com.alcedo.personal 1
```

---

## よくある問題

| 症状 | 確認ポイント |
|---|---|
| サーバーに届かない（エミュレータ） | Server URL が `http://10.0.2.2:8787` になっているか |
| サーバーに届かない（実機） | PC の LAN IP を指定しているか、ファイアウォールが開いているか |
| 認証エラー | 設定画面の API Key が `dev-local-key` と一致しているか |
| `localhost` が繋がらない | Android では `localhost` は端末自身を指す。`10.0.2.2` または LAN IP を使うこと |
| UsageStats が取得できない | 設定 → アプリ → 特別なアクセス → 使用履歴にアクセス → Alcedo を許可 |
| WorkManager が動かない | Doze モードの影響の可能性。手動トリガーか adb ログで確認 |
