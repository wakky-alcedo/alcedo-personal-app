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

## 実機（USB）

1. 開発者オプション → USB デバッグを有効化
2. PC に接続 → `adb devices` で認識を確認

**サーバー接続**: PC の LAN IP（例: `http://192.168.1.x:8787`）を設定画面の Server URL に入力。
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
