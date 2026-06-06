import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
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

    CREATE TABLE IF NOT EXISTS activity_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      field TEXT NOT NULL DEFAULT 'processName',
      category TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}
