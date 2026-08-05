import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
  const habitCols = db.prepare("PRAGMA table_info(habits)").all() as Array<{ name: string }>;

  if (!habitCols.some((c) => c.name === "allowedMissDays")) {
    db.exec("ALTER TABLE habits ADD COLUMN allowedMissDays INTEGER NOT NULL DEFAULT 0");
  }
}
