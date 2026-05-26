import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";

type UpsertTaskInput = {
  id: string;
  title: string;
  description?: string;
  categoryType: "short_term" | "long_term";
  categoryName: string;
  priority: "low" | "medium" | "high";
  dueAt?: string;
  status: "todo" | "doing" | "done";
  subtasks?: Array<{ id: string; title: string; done: boolean; subtasks?: unknown }>;
  updatedAt: string;
  version: number;
};

type DeleteTaskInput = {
  id: string;
  updatedAt: string;
  version: number;
};

type TaskRow = UpsertTaskInput & {
  deletedAt: string | null;
};

function normalizeSubtasks(subtasks: unknown) {
  if (typeof subtasks === "string") {
    try {
      return normalizeSubtasks(JSON.parse(subtasks));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .filter(Boolean)
    .map((subtask: any) => ({
      id: subtask.id ?? randomUUID(),
      title: String(subtask.title ?? ""),
      description: subtask.description ?? null,
      done: Boolean(subtask.done),
      subtasks: normalizeSubtasks(subtask.subtasks),
    }));
}

function normalizeTaskRow(row: any) {
  return {
    ...row,
    subtasks: normalizeSubtasks(row.subtasks),
  };
}

const taskRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { tasks?: UpsertTaskInput[]; upserts?: UpsertTaskInput[]; deletions?: DeleteTaskInput[] };
  }>("/sync/tasks", async (request) => {
    const upserts = request.body.upserts ?? request.body.tasks ?? [];
    const deletions = request.body.deletions ?? [];

    const normalizedUpserts = upserts.map((item: any) => ({
      id: item.id ?? randomUUID(),
      title: item.title ?? "",
      description: item.description ?? null,
      categoryType: item.categoryType ?? "short_term",
      categoryName: item.categoryName ?? "default",
      priority: item.priority ?? "low",
      dueAt: item.dueAt ?? null,
      status: item.status ?? "todo",
      subtasks: JSON.stringify(normalizeSubtasks(item.subtasks)),
      updatedAt: item.updatedAt ?? new Date().toISOString(),
      version: item.version ?? 1,
    }));

    const normalizedDeletions = deletions.map((d: any) => ({
      id: d.id,
      updatedAt: d.updatedAt ?? new Date().toISOString(),
      version: d.version ?? 1,
    }));

    const upsert = db.prepare(`
      INSERT INTO tasks (
        id, title, description, categoryType, categoryName, priority, dueAt, status, subtasks, deletedAt, updatedAt, version
      ) VALUES (
        @id, @title, @description, @categoryType, @categoryName, @priority, @dueAt, @status, @subtasks, NULL, @updatedAt, @version
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        categoryType = excluded.categoryType,
        categoryName = excluded.categoryName,
        priority = excluded.priority,
        dueAt = excluded.dueAt,
        status = excluded.status,
        subtasks = excluded.subtasks,
        deletedAt = NULL,
        updatedAt = excluded.updatedAt,
        version = excluded.version
      WHERE excluded.version > tasks.version
         OR (excluded.version = tasks.version AND excluded.updatedAt > tasks.updatedAt)
    `);

    const markDeleted = db.prepare(`
      UPDATE tasks
      SET
        status = 'done',
        deletedAt = @updatedAt,
        updatedAt = @updatedAt,
        version = @version
      WHERE id = @id
        AND (@version > version OR (@version = version AND @updatedAt > updatedAt))
    `);

    const insertDeletedPlaceholder = db.prepare(`
      INSERT INTO tasks (
        id, title, description, categoryType, categoryName, priority, dueAt, status, subtasks, deletedAt, updatedAt, version
      ) VALUES (
        @id, '', NULL, 'short_term', 'deleted', 'low', NULL, 'done', '[]', @updatedAt, @updatedAt, @version
      )
      ON CONFLICT(id) DO NOTHING
    `);

    const tx = db.transaction((items: UpsertTaskInput[], removed: DeleteTaskInput[]) => {
      for (const task of items) {
        upsert.run(task);
      }

      for (const deletion of removed) {
        insertDeletedPlaceholder.run(deletion);
        markDeleted.run(deletion);
      }
    });

    tx(normalizedUpserts, normalizedDeletions);
    return { acceptedUpserts: normalizedUpserts.length, acceptedDeletions: normalizedDeletions.length };
  });

  app.get("/tasks", async (request) => {
    const since = (request.query as { since?: string }).since;
    if (!since) {
      const rows = db.prepare("SELECT * FROM tasks ORDER BY updatedAt DESC").all();
      return { tasks: rows.map(normalizeTaskRow) };
    }

    const rows = db.prepare("SELECT * FROM tasks WHERE updatedAt > ? ORDER BY updatedAt ASC").all(since);
    return { tasks: rows.map(normalizeTaskRow) };
  });

  app.get("/sync/changes", async (request, reply) => {
    const since = (request.query as { since?: string }).since;
    if (!since) {
      reply.code(400).send({ message: "since is required" });
      return;
    }

    type TaskRow = {
      id: string;
      updatedAt: string;
      version: number;
      deletedAt: string | null;
    };

    const rows = db.prepare("SELECT * FROM tasks WHERE updatedAt > ? ORDER BY updatedAt ASC").all(since) as TaskRow[];
    const upserts = rows.filter((row) => !row.deletedAt).map(normalizeTaskRow);
    const deletions = rows.filter((row) => !!row.deletedAt).map((row) => ({ id: row.id, updatedAt: row.updatedAt, version: row.version }));

    return { upserts, deletions };
  });
};

export { taskRoutes as registerTaskRoutes };