import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db.js";

const SNS_WARN_SEC = 3600;

type AnalyticsRow = {
  id: string;
  targetDate: string;
  source: string;
  category: string;
  durationSec: number;
  createdAt: string;
  updatedAt: string;
};

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  // POST /analytics/daily — upsert a time entry
  app.post<{
    Body: { id?: string; targetDate: string; source?: string; category: string; durationSec: number };
  }>("/analytics/daily", async (request, reply) => {
    const { id, targetDate, source = "manual", category, durationSec } = request.body;
    if (!targetDate || !category || durationSec == null) {
      return reply.code(400).send({ message: "targetDate, category, durationSec are required" });
    }
    const now = new Date().toISOString();
    const entryId = id ?? randomUUID();
    db.prepare(`
      INSERT INTO analytics_daily (id, targetDate, source, category, durationSec, createdAt, updatedAt)
      VALUES (@id, @targetDate, @source, @category, @durationSec, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        durationSec = excluded.durationSec,
        updatedAt = excluded.updatedAt
    `).run({ id: entryId, targetDate, source, category, durationSec, createdAt: now, updatedAt: now });
    return db.prepare("SELECT * FROM analytics_daily WHERE id = ?").get(entryId);
  });

  // GET /analytics/daily?date=YYYY-MM-DD
  app.get("/analytics/daily", async (request) => {
    const date = (request.query as { date?: string }).date ?? new Date().toISOString().slice(0, 10);
    const entries = db
      .prepare("SELECT * FROM analytics_daily WHERE targetDate = ? ORDER BY category, createdAt")
      .all(date) as AnalyticsRow[];
    const totalSec = entries.reduce((s, e) => s + e.durationSec, 0);
    const snsSec = entries.filter((e) => e.category === "SNS").reduce((s, e) => s + e.durationSec, 0);
    return { date, entries, totalSec, snsWarning: snsSec >= SNS_WARN_SEC };
  });

  // DELETE /analytics/daily/:id
  app.delete<{ Params: { id: string } }>("/analytics/daily/:id", async (request) => {
    db.prepare("DELETE FROM analytics_daily WHERE id = ?").run(request.params.id);
    return { deleted: true };
  });

  // GET /analytics/summary?range=weekly|monthly&anchor=YYYY-MM-DD
  app.get("/analytics/summary", async (request) => {
    const { range = "weekly", anchor: anchorStr } = request.query as { range?: string; anchor?: string };
    const anchor = anchorStr ? new Date(anchorStr) : new Date();
    anchor.setHours(0, 0, 0, 0);

    let startDate: Date;
    if (range === "monthly") {
      startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    } else {
      startDate = new Date(anchor);
      startDate.setDate(startDate.getDate() - 6);
    }

    const rows = db
      .prepare(
        `SELECT targetDate, category, SUM(durationSec) as durationSec
         FROM analytics_daily
         WHERE targetDate >= ? AND targetDate <= ?
         GROUP BY targetDate, category
         ORDER BY targetDate`
      )
      .all(startDate.toISOString().slice(0, 10), anchor.toISOString().slice(0, 10)) as Array<{
        targetDate: string;
        category: string;
        durationSec: number;
      }>;

    // Expand into per-day objects for recharts
    const days =
      range === "monthly"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
        : 7;
    const data = Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      const entry: { date: string; [k: string]: string | number } = { date: dateKey };
      for (const r of rows.filter((r) => r.targetDate === dateKey)) {
        entry[r.category] = r.durationSec;
      }
      return entry;
    });

    // SNS warning for anchor day
    const anchorKey = anchor.toISOString().slice(0, 10);
    const snsSec = rows
      .filter((r) => r.targetDate === anchorKey && r.category === "SNS")
      .reduce((s, r) => s + r.durationSec, 0);

    return {
      range,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: anchorKey,
      data,
      snsWarning: snsSec >= SNS_WARN_SEC,
    };
  });
};

export { analyticsRoutes as registerAnalyticsRoutes };
