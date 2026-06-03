import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db.js";

type ActivityLogRow = {
  id: string;
  timestamp: string;
  processName: string;
  windowTitle: string;
  browserUrl: string | null;
  category: string;
  isMediaPlaying: number;
  source: string;
  createdAt: string;
};

type ActivityRuleRow = {
  id: string;
  pattern: string;
  field: string;
  category: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

function classifyLog(
  processName: string,
  windowTitle: string,
  browserUrl: string | null,
  rules: ActivityRuleRow[]
): string {
  for (const rule of rules) {
    const target =
      rule.field === "windowTitle" ? windowTitle :
      rule.field === "browserUrl" ? (browserUrl ?? "") :
      processName;
    try {
      if (new RegExp(rule.pattern, "i").test(target)) {
        return rule.category;
      }
    } catch {
      // invalid regex — skip
    }
  }
  return "未分類";
}

const activityRoutes: FastifyPluginAsync = async (app) => {
  const insertLog = db.prepare(`
    INSERT OR IGNORE INTO activity_logs (id, timestamp, processName, windowTitle, browserUrl, category, isMediaPlaying, source, createdAt)
    VALUES (@id, @timestamp, @processName, @windowTitle, @browserUrl, @category, @isMediaPlaying, @source, @createdAt)
  `);

  // POST /activity/bulk — batch insert from win-tracker
  app.post<{
    Body: {
      logs: Array<{
        timestamp: string;
        processName: string;
        windowTitle: string;
        browserUrl?: string | null;
        isMediaPlaying?: boolean;
      }>;
    };
  }>("/activity/bulk", async (request, reply) => {
    const { logs } = request.body;
    if (!Array.isArray(logs) || logs.length === 0) {
      return reply.code(400).send({ message: "logs array is required" });
    }

    const rules = db
      .prepare("SELECT * FROM activity_rules ORDER BY priority DESC")
      .all() as ActivityRuleRow[];

    const now = new Date().toISOString();
    const inserted: string[] = [];

    const tx = db.transaction(() => {
      for (const log of logs) {
        if (!log.timestamp || !log.processName) continue;
        const id = randomUUID();
        const browserUrl = log.browserUrl ?? null;
        const category = classifyLog(log.processName, log.windowTitle ?? "", browserUrl, rules);
        insertLog.run({
          id,
          timestamp: log.timestamp,
          processName: log.processName,
          windowTitle: log.windowTitle ?? "",
          browserUrl,
          category,
          isMediaPlaying: log.isMediaPlaying ? 1 : 0,
          source: "win-tracker",
          createdAt: now,
        });
        inserted.push(id);
      }
    });
    tx();

    return { inserted: inserted.length };
  });

  // GET /activity/current — latest single record
  app.get("/activity/current", async () => {
    const row = db
      .prepare("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 1")
      .get() as ActivityLogRow | undefined;
    if (!row) return null;
    return { ...row, isMediaPlaying: Boolean(row.isMediaPlaying) };
  });

  // GET /activity/logs?date=YYYY-MM-DD
  app.get("/activity/logs", async (request) => {
    const date =
      (request.query as { date?: string }).date ??
      new Date().toISOString().slice(0, 10);
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const rows = db
      .prepare(
        `SELECT * FROM activity_logs
         WHERE timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`
      )
      .all(startOfDay, endOfDay) as ActivityLogRow[];

    return rows.map((r) => ({
      ...r,
      isMediaPlaying: Boolean(r.isMediaPlaying),
    }));
  });

  // GET /activity/summary?date=YYYY-MM-DD
  app.get("/activity/summary", async (request) => {
    const date =
      (request.query as { date?: string }).date ??
      new Date().toISOString().slice(0, 10);
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    // Each log represents a 15-second sample
    const SAMPLE_SEC = 15;
    const rows = db
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM activity_logs
         WHERE timestamp >= ? AND timestamp <= ?
         GROUP BY category
         ORDER BY count DESC`
      )
      .all(startOfDay, endOfDay) as Array<{ category: string; count: number }>;

    return rows.map((r) => ({
      category: r.category,
      durationSec: r.count * SAMPLE_SEC,
    }));
  });

  // POST /activity/logs/:id/category — manual category correction
  app.post<{
    Params: { id: string };
    Body: { category: string };
  }>("/activity/logs/:id/category", async (request, reply) => {
    const { id } = request.params;
    const { category } = request.body;
    if (!category) {
      return reply.code(400).send({ message: "category is required" });
    }
    db.prepare("UPDATE activity_logs SET category = ? WHERE id = ?").run(
      category,
      id
    );
    return { updated: true };
  });

  // GET /activity/rules
  app.get("/activity/rules", async () => {
    return db
      .prepare("SELECT * FROM activity_rules ORDER BY priority DESC")
      .all() as ActivityRuleRow[];
  });

  // POST /activity/rules — create or update
  app.post<{
    Body: {
      id?: string;
      pattern: string;
      field?: string;
      category: string;
      priority?: number;
    };
  }>("/activity/rules", async (request, reply) => {
    const { id, pattern, field = "processName", category, priority = 0 } =
      request.body;
    if (!pattern || !category) {
      return reply
        .code(400)
        .send({ message: "pattern and category are required" });
    }
    // Validate regex
    try {
      new RegExp(pattern);
    } catch {
      return reply.code(400).send({ message: "invalid regex pattern" });
    }

    const now = new Date().toISOString();
    const ruleId = id ?? randomUUID();
    db.prepare(
      `INSERT INTO activity_rules (id, pattern, field, category, priority, createdAt, updatedAt)
       VALUES (@id, @pattern, @field, @category, @priority, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         pattern = excluded.pattern,
         field = excluded.field,
         category = excluded.category,
         priority = excluded.priority,
         updatedAt = excluded.updatedAt`
    ).run({
      id: ruleId,
      pattern,
      field,
      category,
      priority,
      createdAt: now,
      updatedAt: now,
    });

    return db
      .prepare("SELECT * FROM activity_rules WHERE id = ?")
      .get(ruleId);
  });

  // DELETE /activity/rules/:id
  app.delete<{ Params: { id: string } }>(
    "/activity/rules/:id",
    async (request) => {
      db.prepare("DELETE FROM activity_rules WHERE id = ?").run(
        request.params.id
      );
      return { deleted: true };
    }
  );
};

export { activityRoutes as registerActivityRoutes };
