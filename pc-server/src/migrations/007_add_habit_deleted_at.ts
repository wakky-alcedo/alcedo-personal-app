import type Database from "better-sqlite3";

// Habits switch from physical delete to soft delete (tombstone), matching tasks/memos.
export function run(db: InstanceType<typeof Database>): void {
  const habitCols = db.prepare("PRAGMA table_info(habits)").all() as Array<{ name: string }>;

  if (!habitCols.some((c) => c.name === "deletedAt")) {
    db.exec("ALTER TABLE habits ADD COLUMN deletedAt TEXT");
  }
}
