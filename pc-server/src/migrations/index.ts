import type Database from "better-sqlite3";
import { run as migration001 } from "./001_initial_schema.js";
import { run as migration002 } from "./002_add_columns.js";
import { run as migration003 } from "./003_activity_logs_reshape.js";
import { run as migration004 } from "./004_add_memos.js";
import { run as migration005 } from "./005_add_task_due_time.js";
import { run as migration006 } from "./006_add_habit_allowed_miss_days.js";

export function runMigrations(db: InstanceType<typeof Database>): void {
  migration001(db);
  migration002(db);
  migration003(db);
  migration004(db);
  migration005(db);
  migration006(db);
}
