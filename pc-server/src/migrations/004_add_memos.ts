import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      source_url TEXT,
      source_title TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memos_updated ON memos(updated_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_memos_created ON memos(created_at)`);
}
