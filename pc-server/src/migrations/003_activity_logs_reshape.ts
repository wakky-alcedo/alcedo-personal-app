import type Database from "better-sqlite3";

export function run(db: InstanceType<typeof Database>): void {
  const cols = db.prepare("PRAGMA table_info(activity_logs)").all() as Array<{ name: string }>;
  const hasTimestamp = cols.some((c) => c.name === "timestamp");
  const hasStartedAt = cols.some((c) => c.name === "startedAt");

  if (hasTimestamp && !hasStartedAt) {
    db.exec("ALTER TABLE activity_logs RENAME TO activity_logs_v1");
  }

  if (!hasStartedAt) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        deviceId TEXT NOT NULL DEFAULT 'unknown',
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        processName TEXT NOT NULL,
        windowTitle TEXT NOT NULL DEFAULT '',
        browserUrl TEXT,
        category TEXT NOT NULL DEFAULT '未分類',
        isMediaPlaying INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'win-tracker',
        createdAt TEXT NOT NULL,
        UNIQUE(deviceId, startedAt)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_started ON activity_logs(startedAt)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_device ON activity_logs(deviceId, startedAt)`);
  }

  if (hasTimestamp && !hasStartedAt) {
    db.exec(`
      INSERT OR IGNORE INTO activity_logs
        (id, deviceId, startedAt, endedAt, processName, windowTitle, browserUrl, category, isMediaPlaying, source, createdAt)
      SELECT
        id, 'unknown', timestamp, datetime(timestamp, '+15 seconds'),
        processName, windowTitle, browserUrl, category, isMediaPlaying, source, createdAt
      FROM activity_logs_v1
    `);
    db.exec("DROP TABLE activity_logs_v1");
  }

  // Fix incorrectly migrated 'unknown' device sessions stretched beyond 60s
  db.exec(`
    UPDATE activity_logs
    SET endedAt = datetime(startedAt, '+15 seconds')
    WHERE deviceId = 'unknown'
      AND endedAt IS NOT NULL
      AND (julianday(endedAt) - julianday(startedAt)) * 86400 > 60
  `);

  // Fix analytics_daily entries where startedAt > endedAt (old toISO bug)
  const bad = db.prepare(`
    SELECT id, startedAt, endedAt FROM analytics_daily
    WHERE startedAt IS NOT NULL AND endedAt IS NOT NULL AND startedAt > endedAt
  `).all() as Array<{ id: string; startedAt: string; endedAt: string }>;
  if (bad.length > 0) {
    const fix = db.prepare("UPDATE analytics_daily SET startedAt = ? WHERE id = ?");
    for (const row of bad) {
      const corrected = new Date(new Date(row.startedAt).getTime() - 86400_000).toISOString();
      fix.run(corrected, row.id);
    }
    console.log(`[migration] fixed ${bad.length} analytics_daily entries with inverted startedAt/endedAt`);
  }
}
