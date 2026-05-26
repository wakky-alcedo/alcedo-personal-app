import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";

type HabitInput = {
  id: string;
  name: string;
  notifyTime?: string | null;
  widgetPriorityTimeRangeStart?: string | null;
  widgetPriorityTimeRangeEnd?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function previousDateKey(dateKey: string) {
  const nextDate = new Date(`${dateKey}T00:00:00`);
  nextDate.setDate(nextDate.getDate() - 1);
  return localDateKey(nextDate);
}

function buildHabitViews() {
  const habits = db.prepare("SELECT * FROM habits ORDER BY updatedAt DESC").all() as Array<Record<string, unknown>>;
  const logs = db.prepare("SELECT habitId, doneDate FROM habit_logs ORDER BY doneDate DESC").all() as Array<{ habitId: string; doneDate: string }>;
  const today = localDateKey();

  return habits.map((habit) => {
    const habitId = String(habit.id);
    const habitLogs = logs.filter((log) => log.habitId === habitId).map((log) => log.doneDate);
    const logSet = new Set(habitLogs);
    const sortedDates = Array.from(logSet).sort().reverse();
    let streakDays = 0;
    // Start from today; fall back to yesterday so a streak isn't broken
    // before the user has had a chance to check in today.
    let cursor: string | null = logSet.has(today) ? today : previousDateKey(today);

    while (cursor && logSet.has(cursor)) {
      streakDays += 1;
      cursor = previousDateKey(cursor);
    }

    return {
      ...habit,
      isActive: Boolean(habit.isActive),
      completedToday: logSet.has(today),
      streakDays,
      lastDoneDate: sortedDates[0] ?? null,
    };
  });
}

const habitRoutes: FastifyPluginAsync = async (app) => {
  app.get("/habits", async () => {
    return { habits: buildHabitViews() };
  });

  app.post<{ Body: HabitInput }>("/habits", async (request) => {
    const habit = {
      id: request.body.id ?? randomUUID(),
      name: request.body.name ?? "",
      notifyTime: request.body.notifyTime ?? null,
      widgetPriorityTimeRangeStart: request.body.widgetPriorityTimeRangeStart ?? null,
      widgetPriorityTimeRangeEnd: request.body.widgetPriorityTimeRangeEnd ?? null,
      isActive: request.body.isActive ?? true,
      createdAt: request.body.createdAt ?? new Date().toISOString(),
      updatedAt: request.body.updatedAt ?? new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO habits (
        id, name, notifyTime, widgetPriorityTimeRangeStart, widgetPriorityTimeRangeEnd, isActive, createdAt, updatedAt
      ) VALUES (
        @id, @name, @notifyTime, @widgetPriorityTimeRangeStart, @widgetPriorityTimeRangeEnd, @isActive, @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        notifyTime = excluded.notifyTime,
        widgetPriorityTimeRangeStart = excluded.widgetPriorityTimeRangeStart,
        widgetPriorityTimeRangeEnd = excluded.widgetPriorityTimeRangeEnd,
        isActive = excluded.isActive,
        updatedAt = excluded.updatedAt
    `).run({ ...habit, isActive: habit.isActive ? 1 : 0 });

    return { habit: { ...habit, isActive: Boolean(habit.isActive) } };
  });

  app.delete<{ Params: { id: string } }>("/habits/:id", async (request) => {
    db.prepare("DELETE FROM habit_logs WHERE habitId = ?").run(request.params.id);
    db.prepare("DELETE FROM habits WHERE id = ?").run(request.params.id);
    return { deleted: true };
  });

  app.post<{ Params: { id: string }; Body?: { doneDate?: string } }>("/habits/:id/logs", async (request) => {
    const doneDate = request.body?.doneDate ?? localDateKey();
    db.prepare(`
      INSERT INTO habit_logs (id, habitId, doneDate, createdAt)
      VALUES (@id, @habitId, @doneDate, @createdAt)
      ON CONFLICT(habitId, doneDate) DO NOTHING
    `).run({
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