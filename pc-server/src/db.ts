import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrations/index.js";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "pc-server", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

runMigrations(db);
