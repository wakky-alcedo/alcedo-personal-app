import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrations/index.js";

export type Db = InstanceType<typeof Database>;

/** Route plugin options: every route receives the DB handle instead of importing a singleton. */
export type RouteOptions = { db: Db };

/** Resolves the on-disk DB path from DATA_DIR (production: /data via docker volume). */
export function resolveDbPath(): string {
  const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "pc-server", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "app.sqlite");
}

/** Opens a SQLite DB and applies migrations. Pass ":memory:" in tests. */
export function openDatabase(file: string): Db {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}
