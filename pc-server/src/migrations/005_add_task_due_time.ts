import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
  const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;

  if (!taskCols.some((c) => c.name === "dueTime")) {
    db.exec("ALTER TABLE tasks ADD COLUMN dueTime TEXT");
  }
}
