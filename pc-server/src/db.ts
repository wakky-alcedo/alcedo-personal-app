import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "pc-server", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  categoryType TEXT NOT NULL,
  categoryName TEXT NOT NULL,
  priority TEXT NOT NULL,
  dueAt TEXT,
  status TEXT NOT NULL,
  subtasks TEXT NOT NULL DEFAULT '[]',
  deletedAt TEXT,
  updatedAt TEXT NOT NULL,
  version INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updatedAt);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deletedAt);

CREATE TABLE IF NOT EXISTS beliefs (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  isActive INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beliefs_updated_at ON beliefs(updatedAt);
CREATE INDEX IF NOT EXISTS idx_beliefs_is_active ON beliefs(isActive);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notifyTime TEXT,
  widgetPriorityTimeRangeStart TEXT,
  widgetPriorityTimeRangeEnd TEXT,
  isActive INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_updated_at ON habits(updatedAt);
CREATE INDEX IF NOT EXISTS idx_habits_is_active ON habits(isActive);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habitId TEXT NOT NULL,
  doneDate TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(habitId, doneDate)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habitId);
CREATE INDEX IF NOT EXISTS idx_habit_logs_done_date ON habit_logs(doneDate);
`);

// Backward-compatible migration for existing local databases.
const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
const hasDeletedAt = columns.some((column) => column.name === "deletedAt");
if (!hasDeletedAt) {
  db.exec("ALTER TABLE tasks ADD COLUMN deletedAt TEXT");
}

const hasSubtasks = columns.some((column) => column.name === "subtasks");
if (!hasSubtasks) {
  db.exec("ALTER TABLE tasks ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'");
}

const hasParentId = columns.some((column) => column.name === "parentId");
if (!hasParentId) {
  // parentId will be NULL for root tasks; use TEXT to store parent task id
  db.exec("ALTER TABLE tasks ADD COLUMN parentId TEXT NULL");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parentId)");
}

const beliefColumns = db.prepare("PRAGMA table_info(beliefs)").all() as Array<{ name: string }>;
if (beliefColumns.length === 0) {
  db.exec(`
    CREATE TABLE beliefs (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      isActive INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_beliefs_updated_at ON beliefs(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_beliefs_is_active ON beliefs(isActive);
  `);
}

const habitColumns = db.prepare("PRAGMA table_info(habits)").all() as Array<{ name: string }>;
if (habitColumns.length === 0) {
  db.exec(`
    CREATE TABLE habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      notifyTime TEXT,
      widgetPriorityTimeRangeStart TEXT,
      widgetPriorityTimeRangeEnd TEXT,
      isActive INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_habits_updated_at ON habits(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_habits_is_active ON habits(isActive);
  `);
}

const habitLogColumns = db.prepare("PRAGMA table_info(habit_logs)").all() as Array<{ name: string }>;
if (habitLogColumns.length === 0) {
  db.exec(`
    CREATE TABLE habit_logs (
      id TEXT PRIMARY KEY,
      habitId TEXT NOT NULL,
      doneDate TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(habitId, doneDate)
    );
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habitId);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_done_date ON habit_logs(doneDate);
  `);
}

// Phase 2: analytics tables
db.exec(`
CREATE TABLE IF NOT EXISTS analytics_daily (
  id TEXT PRIMARY KEY,
  targetDate TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  category TEXT NOT NULL,
  durationSec INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(targetDate);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_updated ON analytics_daily(updatedAt);
`);
