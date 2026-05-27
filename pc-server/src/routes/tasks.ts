import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { broadcast } from "./events.js";

type UpsertTaskInput = {
  id: string;
  title: string;
  description?: string;
  categoryType: "short_term" | "long_term";
  categoryName: string;
  priority: "low" | "medium" | "high";
  dueAt?: string;
  status: "todo" | "doing" | "done";
  // optional legacy nested subtasks or flat parentId model
  subtasks?: Array<{ id: string; title: string; done: boolean; dueAt?: string | null; priority?: 'low' | 'medium' | 'high'; subtasks?: unknown }>;
  parentId?: string | null;
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
  parentId: string | null;
};

type StoredSubtask = {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  dueAt: string | null;
  priority: 'low' | 'medium' | 'high';
  parentId?: string | null;
  subtasks: StoredSubtask[];
};

type NormalizedUpsertRow = {
  id: string;
  title: string;
  description: string | null;
  categoryType: "short_term" | "long_term";
  categoryName: string;
  priority: "low" | "medium" | "high";
  dueAt: string | null;
  status: "todo" | "doing" | "done";
  subtasks: string;
  parentId: string | null;
  updatedAt: string;
  version: number;
};

function normalizeSubtasks(subtasks: unknown): StoredSubtask[] {
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
    .map((subtask: any): StoredSubtask => ({
      id: subtask.id ?? randomUUID(),
      title: String(subtask.title ?? ""),
      description: subtask.description ?? null,
      done: Boolean(subtask.done),
      dueAt: subtask.dueAt ?? null,
      priority: (subtask.priority as any) ?? 'medium',
      parentId: subtask.parentId ?? null,
      subtasks: normalizeSubtasks(subtask.subtasks),
    }));
}

function normalizeTaskRow(row: any) {
  return {
    ...row,
    subtasks: normalizeSubtasks(row.subtasks),
    parentId: row.parentId ?? null,
  };
}

const taskRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { tasks?: UpsertTaskInput[]; upserts?: UpsertTaskInput[]; deletions?: DeleteTaskInput[] };
  }>("/sync/tasks", async (request) => {
    const upserts = request.body.upserts ?? request.body.tasks ?? [];
    const deletions = request.body.deletions ?? [];

    const normalizedUpserts: NormalizedUpsertRow[] = upserts.map((item: any) => ({
      id: item.id ?? randomUUID(),
      title: item.title ?? "",
      description: item.description ?? null,
      categoryType: item.categoryType ?? "short_term",
      categoryName: item.categoryName ?? "default",
      priority: item.priority ?? "medium",
      dueAt: item.dueAt ?? null,
      status: item.status ?? "todo",
      // preserve legacy subtasks JSON if provided, but prefer parentId model
      subtasks: JSON.stringify(normalizeSubtasks(item.subtasks)),
      parentId: item.parentId ?? null,
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
        id, title, description, categoryType, categoryName, priority, dueAt, status, subtasks, parentId, deletedAt, updatedAt, version
      ) VALUES (
        @id, @title, @description, @categoryType, @categoryName, @priority, @dueAt, @status, @subtasks, @parentId, NULL, @updatedAt, @version
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
        parentId = excluded.parentId,
        deletedAt = CASE WHEN excluded.version > tasks.version THEN NULL ELSE tasks.deletedAt END,
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

    const tx = db.transaction((items: NormalizedUpsertRow[], removed: DeleteTaskInput[]) => {
      for (const task of items) {
        upsert.run(task);
      }

      for (const deletion of removed) {
        insertDeletedPlaceholder.run(deletion);
        markDeleted.run(deletion);
      }
    });

    tx(normalizedUpserts, normalizedDeletions);
    broadcast("tasks-changed");
    return { acceptedUpserts: normalizedUpserts.length, acceptedDeletions: normalizedDeletions.length };
  });

  app.get("/tasks", async (request) => {
    const since = (request.query as { since?: string }).since;
    let rows: any[] = []
    if (!since) {
      rows = db.prepare("SELECT * FROM tasks WHERE deletedAt IS NULL ORDER BY updatedAt DESC").all();
    } else {
      rows = db.prepare("SELECT * FROM tasks WHERE deletedAt IS NULL AND updatedAt > ? ORDER BY updatedAt ASC").all(since);
    }

    // Build tree from flat rows using parentId
    const map = new Map<string, any>();
    for (const r of rows) {
      const normalized = normalizeTaskRow(r);
      map.set(r.id, { ...normalized, subtasks: normalized.subtasks.slice() });
    }
    const roots: any[] = [];
    for (const r of rows) {
      const node = map.get(r.id)!;
      const pid = r.parentId ?? null;
      if (pid && map.has(pid)) {
        map.get(pid).subtasks.push(node);
      } else {
        roots.push(node);
      }
    }
    return { tasks: roots };
  });

  app.get("/sync/changes", async (request, reply) => {
    const since = (request.query as { since?: string }).since;
    if (!since) {
      reply.code(400).send({ message: "since is required" });
      return;
    }

    type SyncRow = {
      id: string;
      updatedAt: string;
      version: number;
      deletedAt: string | null;
      parentId: string | null;
    };

    const rows = db.prepare("SELECT * FROM tasks WHERE updatedAt > ? ORDER BY updatedAt ASC").all(since) as SyncRow[];
    const liveRows = rows.filter((r) => !r.deletedAt);
    const deletedRows = rows.filter((r) => !!r.deletedAt);

    // Build tree from live rows only
    const map = new Map<string, any>();
    for (const r of liveRows) {
      const normalized = normalizeTaskRow(r);
      map.set(r.id, { ...normalized, subtasks: normalized.subtasks.slice() });
    }
    const roots: any[] = [];
    for (const r of liveRows) {
      const node = map.get(r.id)!;
      const pid = r.parentId ?? null;
      if (pid && map.has(pid)) map.get(pid).subtasks.push(node);
      else roots.push(node);
    }
    const upserts = roots;
    const deletions = deletedRows.map((row) => ({ id: row.id, updatedAt: row.updatedAt, version: row.version }));

    return { upserts, deletions };
  });
};

export { taskRoutes as registerTaskRoutes };