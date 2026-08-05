import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { localDateKey, effectiveLocalDate } from "../utils/date.js";

type HabitInput = {
  id: string;
  name: string;
  notifyTime?: string | null;
  widgetPriorityTimeRangeStart?: string | null;
  widgetPriorityTimeRangeEnd?: string | null;
  allowedMissDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const stmtSelectHabits = db.prepare("SELECT * FROM habits ORDER BY updatedAt DESC");
const stmtSelectHabitLogs = db.prepare("SELECT habitId, doneDate FROM habit_logs ORDER BY doneDate DESC");
const stmtSelectHabitLogsByDate = db.prepare("SELECT habitId, doneDate FROM habit_logs WHERE doneDate >= ? AND doneDate <= ? ORDER BY doneDate ASC");
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
`);
const stmtDeleteHabitLogs = db.prepare("DELETE FROM habit_logs WHERE habitId = ?");
const stmtDeleteHabit = db.prepare("DELETE FROM habits WHERE id = ?");
const stmtInsertHabitLog = db.prepare(`
  INSERT INTO habit_logs (id, habitId, doneDate, createdAt)
  VALUES (@id, @habitId, @doneDate, @createdAt)
  ON CONFLICT(habitId, doneDate) DO NOTHING
`);

// Pure calendar-day arithmetic on an already-resolved date key. Must not
// reuse localDateKey() here: dateKey is already an effective local date,
// so re-applying the JST offset would double-convert and skip days.
function previousDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Walks backward from `today` (or yesterday, if today isn't logged yet),
// counting completed days. A run of missed days is skipped over (not
// counted) as long as its length is within `allowedMissDays`; a longer
// run breaks the streak.
export function computeStreakDays(logSet: Set<string>, today: string, allowedMissDays: number): number {
  if (logSet.size === 0) return 0;

  const sortedDates = Array.from(logSet).sort();
  const earliestDate: string | null = sortedDates[0] ?? null;
  let streakDays = 0;
  let cursor: string | null = logSet.has(today) ? today : previousDateKey(today);

  while (cursor && (!earliestDate || cursor >= earliestDate)) {
    if (logSet.has(cursor)) {
      streakDays += 1;
      cursor = previousDateKey(cursor);
      continue;
    }

    let gapLen = 0;
    let probe: string | null = cursor;
    while (probe && !logSet.has(probe) && (!earliestDate || probe >= earliestDate)) {
      gapLen += 1;
      probe = previousDateKey(probe);
    }

    if (gapLen <= allowedMissDays) {
      cursor = probe;
      continue;
    }

    break;
  }

  return streakDays;
}

function buildHabitViews() {
  const habits = stmtSelectHabits.all() as Array<Record<string, unknown>>;
  const logs = stmtSelectHabitLogs.all() as Array<{ habitId: string; doneDate: string }>;
  const today = effectiveLocalDate();

  return habits.map((habit) => {
    const habitId = String(habit.id);
    const habitLogs = logs.filter((log) => log.habitId === habitId).map((log) => log.doneDate);
    const logSet = new Set(habitLogs);
    const sortedDates = Array.from(logSet).sort().reverse();
    const allowedMissDays = Number(habit.allowedMissDays ?? 0);

    return {
      ...habit,
      id: String(habit.id),
      allowedMissDays,
      isActive: Boolean(habit.isActive),
      completedToday: logSet.has(today),
      streakDays: computeStreakDays(logSet, today, allowedMissDays),
      lastDoneDate: sortedDates[0] ?? null,
    };
  });
}

const habitRoutes: FastifyPluginAsync = async (app) => {
  app.get("/habits", async () => {
    return { habits: buildHabitViews() };
  });

  // GET /habits/logs?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get("/habits/logs", async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const toDate = to ?? effectiveLocalDate();
    const fromDate = from ?? (() => {
      const d = new Date(`${toDate}T00:00:00`);
      d.setDate(d.getDate() - 59);
      return localDateKey(d);
    })();
    return stmtSelectHabitLogsByDate.all(fromDate, toDate) as Array<{ habitId: string; doneDate: string }>;
  });

  app.post<{ Body: HabitInput }>("/habits", async (request) => {
    const habit = {
      id: request.body.id ?? randomUUID(),
      name: request.body.name ?? "",
      notifyTime: request.body.notifyTime ?? null,
      widgetPriorityTimeRangeStart: request.body.widgetPriorityTimeRangeStart ?? null,
      widgetPriorityTimeRangeEnd: request.body.widgetPriorityTimeRangeEnd ?? null,
      allowedMissDays: Math.max(0, Math.trunc(Number(request.body.allowedMissDays ?? 0)) || 0),
      isActive: request.body.isActive ?? true,
      createdAt: request.body.createdAt ?? new Date().toISOString(),
      updatedAt: request.body.updatedAt ?? new Date().toISOString(),
    };

    stmtUpsertHabit.run({ ...habit, isActive: habit.isActive ? 1 : 0 });

    return { habit: { ...habit, isActive: Boolean(habit.isActive) } };
  });

  app.delete<{ Params: { id: string } }>("/habits/:id", async (request) => {
    stmtDeleteHabitLogs.run(request.params.id);
    stmtDeleteHabit.run(request.params.id);
    return { deleted: true };
  });

  app.post<{ Params: { id: string }; Body?: { doneDate?: string } }>("/habits/:id/logs", async (request) => {
    const doneDate = request.body?.doneDate ?? effectiveLocalDate();
    stmtInsertHabitLog.run({
      id: randomUUID(),
      habitId: request.params.id,
      doneDate,
      createdAt: new Date().toISOString(),
    });

    const habit = buildHabitViews().find((item) => item.id === request.params.id) ?? null;
    return { habit };
  });
};

export { habitRoutes as registerHabitRoutes };