import type Database from "better-sqlite3";

// Physical deletes are banned: beliefs, manual analytics entries and activity rules
// get a deletedAt tombstone like tasks/memos/habits.
const TABLES = ["beliefs", "analytics_daily", "activity_rules"] as const;

export function run(db: InstanceType<typeof Database>): void {
  for (const table of TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "deletedAt")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN deletedAt TEXT`);
    }
  }
}
