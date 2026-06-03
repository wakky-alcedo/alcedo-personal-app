# Alcedo

個人用タスク・習慣・信念・作業記録管理アプリ。

| サブプロジェクト | 説明 |
|---|---|
| `pc-server/` | Fastify + SQLite バックエンド（ポート 8787） |
| `web-app/` | React + Vite フロントエンド（開発: ポート 5173） |
| `win-tracker/` | Windows 作業記録トレイアプリ（C# .NET 8） |

---

## ローカル開発

```powershell
# pc-server（ポート 8787）
cd pc-server; npm install; $env:API_KEY="dev-local-key"; npm run dev

# web-app（ポート 5173）
cd web-app; npm install; npm run dev
```

ブラウザで `http://localhost:5173` を開く（`#dashboard` / `#analytics` / `#settings` でタブ直リンク可）。

### win-tracker を使う場合

→ 詳細は [`win-tracker/README.md`](win-tracker/README.md) を参照。

```powershell
cd win-tracker
dotnet run -c Release
```

---

## Docker Compose で起動する（本番 / Proxmox VM）

### 前提

- Docker / Docker Compose がインストール済み
- Cloudflare Tunnel のトークンを取得済み（Zero Trust ダッシュボード → Tunnels）

### 1. 環境変数を設定する

```bash
cp .env.example .env
```

`.env` を編集：

```env
CLOUDFLARE_TUNNEL_TOKEN=<Cloudflare Zero Trust で発行したトークン>
API_KEY=<任意の強いキー>
VITE_SERVER_URL=https://myappapi.example.com   # バックエンドの公開URL
```

### 2. ビルド・起動

```bash
docker compose up --build -d
```

```bash
docker compose build --no-cache frontend
docker compose up -d
```

| サービス | URL |
|---|---|
| フロントエンド | `http://localhost:3000`（Cloudflare 経由なら公開URL） |
| バックエンド | `http://localhost:8787` |

SQLite データは Docker ボリューム `sqlite_data` に永続化されます。

### 3. 停止

```bash
docker compose down
```

データを含めて完全削除する場合：

```bash
docker compose down -v
```

### 4. 設定変更後の再ビルド

`VITE_SERVER_URL` や `API_KEY` を変更したとき：

```bash
docker compose up --build -d
```

### Cloudflare トンネルのルーティング設定

Zero Trust ダッシュボード → **Tunnels** → Public Hostname に以下を設定：

Select your device's operating system : `Docker`
`tunnel run --token eyJhbGciOi...`が表示される．この `eyJhbGciOi...` の長い文字列（トークン）をコピーして `.env` の `CLOUDFLARE_TUNNEL_TOKEN` に貼り付ける．

| Hostname | Service |
|---|---|
| `myapp.example.com` | `http://frontend:3000` |
| `myappapi.example.com` | `http://backend:8787` |

> **注意**: `localhost` ではなく Docker サービス名（`frontend` / `backend`）を指定すること。
