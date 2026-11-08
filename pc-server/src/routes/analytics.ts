import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import type { RouteOptions } from "../db.js";
import { addDays, effectiveLocalDate, isDateKey } from "../utils/date.js";

const SNS_WARN_SEC = 3600;

type AnalyticsRow = {
  id: string;
  targetDate: string;
  source: string;
  category: string;
  durationSec: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Pure date-key arithmetic (no system-TZ dependency): weekly = the 7 days ending at the
 * anchor; monthly = the whole calendar month containing the anchor.
 */
export function summaryWindow(range: string, anchorKey: string): { startDate: string; days: number } {
  if (range === "monthly") {
    const [y, m] = anchorKey.split("-").map(Number);
    return { startDate: `${anchorKey.slice(0, 7)}-01`, days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
  }
  return { startDate: addDays(anchorKey, -6), days: 7 };
}

const analyticsRoutes: FastifyPluginAsync<RouteOptions> = async (app, { db }) => {
  // POST /analytics/daily — upsert a time entry
  app.post<{
    Body: {
      id?: string; targetDate: string; source?: string; category: string;
      durationSec?: number; startedAt?: string | null; endedAt?: string | null;
    };
  }>("/analytics/daily", async (request, reply) => {
    const { id, targetDate, source = "manual", category, startedAt = null, endedAt = null } = request.body;
    if (!targetDate || !category) {
      return reply.code(400).send({ message: "targetDate and category are required" });
    }
    // durationSec: use provided value, or compute from time range, or 0
    let durationSec = request.body.durationSec ?? 0;
    if (!durationSec && startedAt && endedAt) {
      durationSec = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    }
    const now = new Date().toISOString();
    const entryId = id ?? randomUUID();
    db.prepare(`
      INSERT INTO analytics_daily (id, targetDate, source, category, durationSec, startedAt, endedAt, createdAt, updatedAt)
      VALUES (@id, @targetDate, @source, @category, @durationSec, @startedAt, @endedAt, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        durationSec = excluded.durationSec,
        startedAt = excluded.startedAt,
        endedAt = excluded.endedAt,
        updatedAt = excluded.updatedAt
    `).run({ id: entryId, targetDate, source, category, durationSec, startedAt, endedAt, createdAt: now, updatedAt: now });
    return db.prepare("SELECT * FROM analytics_daily WHERE id = ?").get(entryId);
  });

  // GET /analytics/daily?date=YYYY-MM-DD
  app.get<{ Querystring: { date?: string } }>("/analytics/daily", async (request, reply) => {
    const { date: dateParam } = request.query;
    if (dateParam !== undefined && !isDateKey(dateParam)) return reply.code(400).send({ message: "date must be YYYY-MM-DD" });
    const date = dateParam ?? effectiveLocalDate();
    const entries = db
      .prepare("SELECT * FROM analytics_daily WHERE targetDate = ? AND deletedAt IS NULL ORDER BY category, createdAt")
      .all(date) as AnalyticsRow[];
    const totalSec = entries.reduce((s, e) => s + e.durationSec, 0);
    const snsSec = entries.filter((e) => e.category === "SNS").reduce((s, e) => s + e.durationSec, 0);
    return { date, entries, totalSec, snsWarning: snsSec >= SNS_WARN_SEC };
  });

  // DELETE /analytics/daily/:id
  app.delete<{ Params: { id: string } }>("/analytics/daily/:id", async (request) => {
    const now = new Date().toISOString();
    db.prepare("UPDATE analytics_daily SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL").run(now, now, request.params.id);
    return { deleted: true };
  });

  // GET /analytics/summary?range=weekly|monthly&anchor=YYYY-MM-DD
  app.get<{ Querystring: { range?: string; anchor?: string } }>("/analytics/summary", async (request, reply) => {
    const { range = "weekly", anchor: anchorParam } = request.query;
    if (anchorParam !== undefined && !isDateKey(anchorParam)) return reply.code(400).send({ message: "anchor must be YYYY-MM-DD" });
    const anchorKey = anchorParam ?? effectiveLocalDate();
    const { startDate, days } = summaryWindow(range, anchorKey);

    const rows = db
      .prepare(
        `SELECT targetDate, category, SUM(durationSec) as durationSec
         FROM analytics_daily
         WHERE targetDate >= ? AND targetDate <= ? AND deletedAt IS NULL
         GROUP BY targetDate, category
         ORDER BY targetDate`
      )
      .all(startDate, anchorKey) as Array<{
        targetDate: string;
        category: string;
        durationSec: number;
      }>;

    // Expand into per-day objects for recharts
    const data = Array.from({ length: days }, (_, i) => {
      const dateKey = addDays(startDate, i);
      const entry: { date: string; [k: string]: string | number } = { date: dateKey };
      for (const r of rows.filter((r) => r.targetDate === dateKey)) {
        entry[r.category] = r.durationSec;
      }
      return entry;
    });

    // SNS warning for anchor day
    const snsSec = rows
      .filter((r) => r.targetDate === anchorKey && r.category === "SNS")
      .reduce((s, r) => s + r.durationSec, 0);

    return {
      range,
      startDate,
      endDate: anchorKey,
      data,
      snsWarning: snsSec >= SNS_WARN_SEC,
    };
  });
};

export { analyticsRoutes as registerAnalyticsRoutes };
