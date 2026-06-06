import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;

  if (!taskCols.some((c) => c.name === "deletedAt")) {
    db.exec("ALTER TABLE tasks ADD COLUMN deletedAt TEXT");
  }
  if (!taskCols.some((c) => c.name === "subtasks")) {
    db.exec("ALTER TABLE tasks ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'");
  }
  if (!taskCols.some((c) => c.name === "parentId")) {
    db.exec("ALTER TABLE tasks ADD COLUMN parentId TEXT NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parentId)");
  }

  const analyticsCols = db.prepare("PRAGMA table_info(analytics_daily)").all() as Array<{ name: string }>;
  if (!analyticsCols.some((c) => c.name === "startedAt")) {
    db.exec("ALTER TABLE analytics_daily ADD COLUMN startedAt TEXT");
  }
  if (!analyticsCols.some((c) => c.name === "endedAt")) {
    db.exec("ALTER TABLE analytics_daily ADD COLUMN endedAt TEXT");
  }
}
