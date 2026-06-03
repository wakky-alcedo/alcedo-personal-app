import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db.js";

/** 6時閾値で補正した実効ローカル日付（YYYY-MM-DD） */
function effectiveLocalDate(): string {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
}

type ActivityLogRow = {
  id: string;
  deviceId: string;
  startedAt: string;
  endedAt: string | null;
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
      if (new RegExp(rule.pattern, "i").test(target)) return rule.category;
    } catch { /* invalid regex */ }
  }
  return "未分類";
}

function normalizeRow(r: ActivityLogRow) {
  return { ...r, isMediaPlaying: Boolean(r.isMediaPlaying) };
}

const activityRoutes: FastifyPluginAsync = async (app) => {
  const upsertLog = db.prepare(`
    INSERT INTO activity_logs
      (id, deviceId, startedAt, endedAt, processName, windowTitle, browserUrl, category, isMediaPlaying, source, createdAt)
    VALUES
      (@id, @deviceId, @startedAt, @endedAt, @processName, @windowTitle, @browserUrl, @category, @isMediaPlaying, @source, @createdAt)
    ON CONFLICT(deviceId, startedAt) DO UPDATE SET
      endedAt       = CASE WHEN activity_logs.endedAt IS NOT NULL THEN activity_logs.endedAt ELSE excluded.endedAt END,
      windowTitle   = excluded.windowTitle,
      browserUrl    = excluded.browserUrl,
      category      = excluded.category,
      isMediaPlaying = excluded.isMediaPlaying
  `);

  // POST /activity/bulk — receive sessions from a device
  app.post<{
    Body: {
      deviceId?: string;
      logs: Array<{
        startedAt: string;
        endedAt?: string | null;
        processName: string;
        windowTitle?: string;
        browserUrl?: string | null;
        category?: string | null;   // クライアント側分類（OS標準等）。サーバーのルールにない場合のフォールバック
        isMediaPlaying?: boolean;
      }>;
    };
  }>("/activity/bulk", async (request, reply) => {
    const { deviceId = "unknown", logs } = request.body;
    if (!Array.isArray(logs) || logs.length === 0) {
      return reply.code(400).send({ message: "logs array is required" });
    }

    const rules = db
      .prepare("SELECT * FROM activity_rules ORDER BY priority DESC")
      .all() as ActivityRuleRow[];

    const now = new Date().toISOString();
    const inserted: string[] = [];

    const tx = db.transaction(() => {
      // Phase 3: close other devices' open sessions when this device has an open session
      const openSession = logs.find((l) => !l.endedAt);
      if (openSession) {
        db.prepare(`
          UPDATE activity_logs
          SET endedAt = ?
          WHERE deviceId != ? AND endedAt IS NULL AND startedAt < ?
        `).run(openSession.startedAt, deviceId, openSession.startedAt);
      }

      for (const log of logs) {
        if (!log.startedAt || !log.processName) continue;
        const id = randomUUID();
        const browserUrl = log.browserUrl ?? null;
        const serverCategory = classifyLog(log.processName, log.windowTitle ?? "", browserUrl, rules);
        // サーバーのルールがマッチしない（未分類）場合はクライアント送信のカテゴリをフォールバックとして使用
        const category = serverCategory !== "未分類"
          ? serverCategory
          : (log.category && log.category !== "未分類" ? log.category : "未分類");
        upsertLog.run({
          id,
          deviceId,
          startedAt: log.startedAt,
          endedAt: log.endedAt ?? null,
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

  // GET /activity/current — most recent session (prefer open)
  app.get("/activity/current", async () => {
    const row = db
      .prepare(`
        SELECT * FROM activity_logs
        ORDER BY CASE WHEN endedAt IS NULL THEN 0 ELSE 1 END, startedAt DESC
        LIMIT 1
      `)
      .get() as ActivityLogRow | undefined;
    if (!row) return null;
    return normalizeRow(row);
  });

  // GET /activity/logs?date=YYYY-MM-DD&deviceId=xxx
  app.get("/activity/logs", async (request) => {
    const { date, deviceId } = request.query as { date?: string; deviceId?: string };
    const d = date ?? effectiveLocalDate();
    // 「その日」= ローカル06:00 〜 翌日ローカル06:00
    const startBoundary = new Date(`${d}T06:00:00`).toISOString();
    const endBoundary   = (() => { const e = new Date(`${d}T06:00:00`); e.setDate(e.getDate() + 1); return e.toISOString(); })();

    let query = `SELECT * FROM activity_logs WHERE startedAt >= ? AND startedAt < ?`;
    const params: string[] = [startBoundary, endBoundary];

    if (deviceId) {
      query += ` AND deviceId = ?`;
      params.push(deviceId);
    }

    query += ` ORDER BY startedAt ASC`;

    const rows = db.prepare(query).all(...params) as ActivityLogRow[];
    return rows.map(normalizeRow);
  });

  // GET /activity/summary?date=YYYY-MM-DD&deviceId=xxx
  app.get("/activity/summary", async (request) => {
    const { date, deviceId } = request.query as { date?: string; deviceId?: string };
    const d = date ?? effectiveLocalDate();
    const startBoundary = new Date(`${d}T06:00:00`).toISOString();
    const endBoundary   = (() => { const e = new Date(`${d}T06:00:00`); e.setDate(e.getDate() + 1); return e.toISOString(); })();

    let query = `
      SELECT category,
        CAST(SUM(
          (julianday(COALESCE(endedAt, datetime('now'))) - julianday(startedAt)) * 86400
        ) AS INTEGER) as durationSec
      FROM activity_logs
      WHERE startedAt >= ? AND startedAt < ?
    `;
    const params: string[] = [startBoundary, endBoundary];

    if (deviceId) {
      query += ` AND deviceId = ?`;
      params.push(deviceId);
    }
    query += ` GROUP BY category ORDER BY durationSec DESC`;

    return db.prepare(query).all(...params) as Array<{ category: string; durationSec: number }>;
  });

  // GET /activity/devices?date=YYYY-MM-DD — その日に活動があったデバイス一覧
  app.get("/activity/devices", async (request) => {
    const { date } = request.query as { date?: string };
    if (date) {
      const startBoundary = new Date(`${date}T06:00:00`).toISOString();
      const endBoundary   = (() => { const e = new Date(`${date}T06:00:00`); e.setDate(e.getDate() + 1); return e.toISOString(); })();
      return db
        .prepare("SELECT DISTINCT deviceId FROM activity_logs WHERE startedAt >= ? AND startedAt < ? ORDER BY deviceId")
        .all(startBoundary, endBoundary) as Array<{ deviceId: string }>;
    }
    return db
      .prepare("SELECT DISTINCT deviceId FROM activity_logs ORDER BY deviceId")
      .all() as Array<{ deviceId: string }>;
  });

  // POST /activity/logs/:id/category — manual category correction
  app.post<{ Params: { id: string }; Body: { category: string } }>(
    "/activity/logs/:id/category",
    async (request, reply) => {
      const { id } = request.params;
      const { category } = request.body;
      if (!category) return reply.code(400).send({ message: "category is required" });
      db.prepare("UPDATE activity_logs SET category = ? WHERE id = ?").run(category, id);
      return { updated: true };
    }
  );

  // GET /activity/rules
  app.get("/activity/rules", async () => {
    return db.prepare("SELECT * FROM activity_rules ORDER BY priority DESC").all();
  });

  // POST /activity/rules — create or update
  app.post<{
    Body: { id?: string; pattern: string; field?: string; category: string; priority?: number };
  }>("/activity/rules", async (request, reply) => {
    const { id, pattern, field = "processName", category, priority = 0 } = request.body;
    if (!pattern || !category) {
      return reply.code(400).send({ message: "pattern and category are required" });
    }
    try { new RegExp(pattern); } catch {
      return reply.code(400).send({ message: "invalid regex pattern" });
    }
    const now = new Date().toISOString();
    const ruleId = id ?? randomUUID();
    db.prepare(`
      INSERT INTO activity_rules (id, pattern, field, category, priority, createdAt, updatedAt)
      VALUES (@id, @pattern, @field, @category, @priority, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        pattern = excluded.pattern, field = excluded.field,
        category = excluded.category, priority = excluded.priority,
        updatedAt = excluded.updatedAt
    `).run({ id: ruleId, pattern, field, category, priority, createdAt: now, updatedAt: now });
    return db.prepare("SELECT * FROM activity_rules WHERE id = ?").get(ruleId);
  });

  // DELETE /activity/rules/:id
  app.delete<{ Params: { id: string } }>("/activity/rules/:id", async (request) => {
    db.prepare("DELETE FROM activity_rules WHERE id = ?").run(request.params.id);
    return { deleted: true };
  });

  // POST /activity/reclassify — re-apply current rules to all logs
  app.post("/activity/reclassify", async () => {
    const rules = db
      .prepare("SELECT * FROM activity_rules ORDER BY priority DESC")
      .all() as ActivityRuleRow[];
    const logs = db
      .prepare("SELECT id, processName, windowTitle, browserUrl FROM activity_logs")
      .all() as Array<{ id: string; processName: string; windowTitle: string; browserUrl: string | null }>;

    const update = db.prepare("UPDATE activity_logs SET category = ? WHERE id = ?");
    const tx = db.transaction(() => {
      for (const log of logs) {
        update.run(classifyLog(log.processName, log.windowTitle, log.browserUrl, rules), log.id);
      }
    });
    tx();
    return { updated: logs.length };
  });
};

export { activityRoutes as registerActivityRoutes };
