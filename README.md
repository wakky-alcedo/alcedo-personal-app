# Alcedo

個人用タスク・習慣・信念管理アプリ。

- `pc-server/` — Fastify + SQLite バックエンド
- `web-app/` — React + Vite フロントエンド

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

| Hostname | Service |
|---|---|
| `myapp.example.com` | `http://frontend:3000` |
| `myappapi.example.com` | `http://backend:8787` |

> **注意**: `localhost` ではなく Docker サービス名（`frontend` / `backend`）を指定すること。

---

## ローカル開発

```bash
# バックエンド
cd pc-server && npm install && npm run dev

# フロントエンド（別ターミナル）
cd web-app && npm install && npm run dev
```

詳細は各サブディレクトリの README を参照。
