import type Database from "better-sqlite3";
import { run as migration001 } from "./001_initial_schema.js";
import { run as migration002 } from "./002_add_columns.js";
import { run as migration003 } from "./003_activity_logs_reshape.js";

export function runMigrations(db: InstanceType<typeof Database>): void {
  migration001(db);
  migration002(db);
  migration003(db);
}
