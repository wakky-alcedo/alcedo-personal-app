import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import type { RouteOptions } from "../db.js";
import { addDays, effectiveLocalDate, isDateKey, normalizeIsoTimestamp } from "../utils/date.js";

/** Default window for GET /habits/logs when `from` is omitted (matches the web heatmap). */
const DEFAULT_LOG_WINDOW_DAYS = 60;
/** Client clocks may run slightly ahead around the 6am day boundary; tolerate one day. */
const FUTURE_DATE_TOLERANCE_DAYS = 1;

type HabitRow = {
  id: string;
  name: string;
  notifyTime: string | null;
  widgetPriorityTimeRangeStart: string | null;
  widgetPriorityTimeRangeEnd: string | null;
  allowedMissDays: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type HabitLogRow = { habitId: string; doneDate: string };

// Walks backward from `today` (or yesterday, if today isn't logged yet),
// counting completed days. A run of missed days is skipped over (not
// counted) as long as its length is within `allowedMissDays`; a longer
// run breaks the streak.
export function computeStreakDays(logSet: Set<string>, today: string, allowedMissDays: number): number {
  if (logSet.size === 0) return 0;

  const earliestDate = Array.from(logSet).sort()[0];
  let streakDays = 0;
  let cursor = logSet.has(today) ? today : addDays(today, -1);

  while (cursor >= earliestDate) {
    if (logSet.has(cursor)) {
      streakDays += 1;
      cursor = addDays(cursor, -1);
      continue;
    }

    let gapLen = 0;
    let probe = cursor;
    while (!logSet.has(probe) && probe >= earliestDate) {
      gapLen += 1;
      probe = addDays(probe, -1);
    }

    if (gapLen <= allowedMissDays) {
      cursor = probe;
      continue;
    }

    break;
  }

  return streakDays;
}

/** Builds the wire `Habit` (shared/types.ts) from a stored row and its done dates. */
export function toHabitView(row: HabitRow, doneDates: Iterable<string>, today: string) {
  const logSet = new Set(doneDates);
  const allowedMissDays = Number(row.allowedMissDays ?? 0);
  const { deletedAt: _deletedAt, ...rest } = row;
  return {
    ...rest,
    allowedMissDays,
    isActive: Boolean(row.isActive),
    completedToday: logSet.has(today),
    streakDays: computeStreakDays(logSet, today, allowedMissDays),
    lastDoneDate: logSet.size > 0 ? Array.from(logSet).sort().at(-1)! : null,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

const habitRoutes: FastifyPluginAsync<RouteOptions> = async (app, { db }) => {
  const stmtSelectHabits = db.prepare<[], HabitRow>("SELECT * FROM habits WHERE deletedAt IS NULL ORDER BY updatedAt DESC");
  const stmtSelectHabit = db.prepare<[string], HabitRow>("SELECT * FROM habits WHERE id = ?");
  const stmtSelectAllLogs = db.prepare<[], HabitLogRow>("SELECT habitId, doneDate FROM habit_logs");
  const stmtSelectLogsForHabit = db.prepare<[string], HabitLogRow>("SELECT habitId, doneDate FROM habit_logs WHERE habitId = ?");
  const stmtSelectLogsByDate = db.prepare<[string, string], HabitLogRow>(`
    SELECT l.habitId, l.doneDate FROM habit_logs l
    JOIN habits h ON h.id = l.habitId AND h.deletedAt IS NULL
    WHERE l.doneDate >= ? AND l.doneDate <= ?
    ORDER BY l.doneDate ASC
  `);
  const stmtUpsertHabit = db.prepare(`
    INSERT INTO habits (
      id, name, notifyTime, widgetPriorityTimeRangeStart, widgetPriorityTimeRangeEnd, allowedMissDays, isActive, createdAt, updatedAt
    ) VALUES (
      @id, @name, @notifyTime, @widgetPriorityTimeRangeStart, @widgetPriorityTimeRangeEnd, @allowedMissDays, @isActive, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      notifyTime = excluded.notifyTime,
      widgetPriorityTimeRangeStart = excluded.widgetPriorityTimeRangeStart,
      widgetPriorityTimeRangeEnd = excluded.widgetPriorityTimeRangeEnd,
      allowedMissDays = excluded.allowedMissDays,
      isActive = excluded.isActive,
      updatedAt = excluded.updatedAt
    WHERE julianday(excluded.updatedAt) >= COALESCE(julianday(habits.updatedAt), 0)
  `);
  const stmtSoftDeleteHabit = db.prepare("UPDATE habits SET deletedAt = @now, updatedAt = @now WHERE id = @id AND deletedAt IS NULL");
  const stmtInsertHabitLog = db.prepare(`
    INSERT INTO habit_logs (id, habitId, doneDate, createdAt)
    VALUES (@id, @habitId, @doneDate, @createdAt)
    ON CONFLICT(habitId, doneDate) DO NOTHING
  `);

  function findLiveHabit(id: string): HabitRow | null {
    const row = stmtSelectHabit.get(id);
    return row && !row.deletedAt ? row : null;
  }

  function viewOf(row: HabitRow) {
    const dates = stmtSelectLogsForHabit.all(row.id).map((log) => log.doneDate);
    return toHabitView(row, dates, effectiveLocalDate());
  }

  app.get("/habits", async () => {
    const today = effectiveLocalDate();
    const datesByHabit = new Map<string, string[]>();
    for (const log of stmtSelectAllLogs.all()) {
      const dates = datesByHabit.get(log.habitId);
      if (dates) dates.push(log.doneDate);
      else datesByHabit.set(log.habitId, [log.doneDate]);
    }
    const habits = stmtSelectHabits.all().map((row) => toHabitView(row, datesByHabit.get(row.id) ?? [], today));
    return { habits };
  });

  // GET /habits/logs?from=YYYY-MM-DD&to=YYYY-MM-DD (logs of deleted habits are excluded)
  app.get<{ Querystring: { from?: string; to?: string } }>("/habits/logs", async (request, reply) => {
    const { from, to } = request.query;
    if ((from !== undefined && !isDateKey(from)) || (to !== undefined && !isDateKey(to))) {
      return reply.code(400).send({ message: "from/to must be YYYY-MM-DD" });
    }
    const toDate = to ?? effectiveLocalDate();
    const fromDate = from ?? addDays(toDate, -(DEFAULT_LOG_WINDOW_DAYS - 1));
    return stmtSelectLogsByDate.all(fromDate, toDate);
  });

  app.post<{ Body: Record<string, unknown> | undefined }>("/habits", async (request, reply) => {
    const body = request.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(400).send({ message: "name is required" });

    const id = typeof body.id === "string" && body.id ? body.id : randomUUID();
    const existing = stmtSelectHabit.get(id);
    // A stale client must not resurrect a habit that was deleted elsewhere.
    if (existing?.deletedAt) return reply.code(404).send({ message: "habit was deleted" });

    // Last writer wins by updatedAt: an edit older than the stored one (e.g. an offline
    // Android change re-sent after a newer web edit) is ignored and the current row returned.
    const now = new Date().toISOString();
    stmtUpsertHabit.run({
      id,
      name,
      notifyTime: nullableString(body.notifyTime),
      widgetPriorityTimeRangeStart: nullableString(body.widgetPriorityTimeRangeStart),
      widgetPriorityTimeRangeEnd: nullableString(body.widgetPriorityTimeRangeEnd),
      allowedMissDays: Math.max(0, Math.trunc(Number(body.allowedMissDays ?? 0)) || 0),
      isActive: body.isActive === false ? 0 : 1,
      createdAt: typeof body.createdAt === "string" ? body.createdAt : now,
      updatedAt: normalizeIsoTimestamp(body.updatedAt, now),
    });

    return { habit: viewOf(stmtSelectHabit.get(id)!) };
  });

  // Soft delete: the habit row and its logs are kept as history (physical deletes are banned).
  app.delete<{ Params: { id: string } }>("/habits/:id", async (request) => {
    stmtSoftDeleteHabit.run({ id: request.params.id, now: new Date().toISOString() });
    return { deleted: true };
  });

  // POST /habits/:id/logs { doneDate?: YYYY-MM-DD }
  // Omit doneDate to let the server decide "today" (JST, 6am boundary). Offline clients
  // retrying a queued check-in send the date it was originally made.
  app.post<{ Params: { id: string }; Body: Record<string, unknown> | undefined }>("/habits/:id/logs", async (request, reply) => {
    const today = effectiveLocalDate();
    const rawDate = request.body?.doneDate;
    if (rawDate !== undefined && rawDate !== null && !isDateKey(rawDate)) {
      return reply.code(400).send({ message: "doneDate must be YYYY-MM-DD" });
    }
    const doneDate = isDateKey(rawDate) ? rawDate : today;
    if (doneDate > addDays(today, FUTURE_DATE_TOLERANCE_DAYS)) return reply.code(400).send({ message: "doneDate is in the future" });

    const habit = findLiveHabit(request.params.id);
    if (!habit) return reply.code(404).send({ message: "habit not found" });

    stmtInsertHabitLog.run({ id: randomUUID(), habitId: habit.id, doneDate, createdAt: new Date().toISOString() });
    return { habit: viewOf(habit) };
  });
};

export { habitRoutes as registerHabitRoutes };
