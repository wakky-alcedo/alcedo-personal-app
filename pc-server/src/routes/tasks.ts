import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import type { RouteOptions } from "../db.js";
import { broadcast } from "./events.js";

type UpsertTaskInput = {
  id: string;
  title: string;
  description?: string;
  categoryType: "short_term" | "long_term";
  categoryName: string;
  priority: "low" | "medium" | "high";
  dueAt?: string;
  dueTime?: string | null;
  status: "todo" | "doing" | "done";
  // optional legacy nested subtasks or flat parentId model
  subtasks?: Array<{ id: string; title: string; status?: 'todo' | 'doing' | 'done'; done?: boolean; dueAt?: string | null; priority?: 'low' | 'medium' | 'high'; subtasks?: unknown }>;
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
  status: 'todo' | 'doing' | 'done';
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
  dueTime: string | null;
  status: "todo" | "doing" | "done";
  subtasks: string;
  parentId: string | null;
  updatedAt: string;
  version: number;
};

function normalizeSubtaskStatus(status: unknown, legacyDone: unknown): 'todo' | 'doing' | 'done' {
  if (status === 'todo' || status === 'doing' || status === 'done') return status;
  return legacyDone ? 'done' : 'todo';
}

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
    .map((subtask: Record<string, unknown>): StoredSubtask => ({
      id: (subtask.id as string) ?? randomUUID(),
      title: String(subtask.title ?? ""),
      description: (subtask.description as string | null) ?? null,
      status: normalizeSubtaskStatus(subtask.status, subtask.done),
      dueAt: (subtask.dueAt as string | null) ?? null,
      priority: ((subtask.priority as StoredSubtask['priority']) ?? 'medium'),
      parentId: (subtask.parentId as string | null) ?? null,
      subtasks: normalizeSubtasks(subtask.subtasks),
    }));
}

function normalizeTaskRow(row: TaskRow) {
  return {
    ...row,
    subtasks: normalizeSubtasks(row.subtasks),
    parentId: row.parentId ?? null,
  };
}

/**
 * Nests flat `parentId` rows under their parent's `subtasks` (legacy flat model; the JSON
 * `subtasks` column is the primary model). Rows whose parent isn't in `rows` become roots.
 */
function buildTaskTree(rows: TaskRow[]) {
  type TaskNode = ReturnType<typeof normalizeTaskRow> & { subtasks: unknown[] };
  const byId = new Map<string, TaskNode>();
  for (const row of rows) {
    const normalized = normalizeTaskRow(row);
    byId.set(row.id, { ...normalized, subtasks: normalized.subtasks.slice() });
  }
  const roots: TaskNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) parent.subtasks.push(node);
    else roots.push(node);
  }
  return roots;
}

const taskRoutes: FastifyPluginAsync<RouteOptions> = async (app, { db }) => {
  const stmtListLive = db.prepare<[], TaskRow>("SELECT * FROM tasks WHERE deletedAt IS NULL ORDER BY updatedAt DESC");
  const stmtListLiveSince = db.prepare<[string], TaskRow>("SELECT * FROM tasks WHERE deletedAt IS NULL AND updatedAt > ? ORDER BY updatedAt ASC");
  const stmtListChangedSince = db.prepare<[string], TaskRow>("SELECT * FROM tasks WHERE updatedAt > ? ORDER BY updatedAt ASC");
  const stmtUpsertTask = db.prepare(`
    INSERT INTO tasks (
      id, title, description, categoryType, categoryName, priority, dueAt, dueTime, status, subtasks, parentId, deletedAt, updatedAt, version
    ) VALUES (
      @id, @title, @description, @categoryType, @categoryName, @priority, @dueAt, @dueTime, @status, @subtasks, @parentId, NULL, @updatedAt, @version
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      categoryType = excluded.categoryType,
      categoryName = excluded.categoryName,
      priority = excluded.priority,
      dueAt = excluded.dueAt,
      dueTime = excluded.dueTime,
      status = excluded.status,
      subtasks = excluded.subtasks,
      parentId = excluded.parentId,
      deletedAt = CASE WHEN excluded.version > tasks.version THEN NULL ELSE tasks.deletedAt END,
      updatedAt = excluded.updatedAt,
      version = excluded.version
    WHERE excluded.version > tasks.version
       OR (excluded.version = tasks.version AND excluded.updatedAt > tasks.updatedAt)
  `);
  const stmtMarkDeleted = db.prepare(`
    UPDATE tasks
    SET
      status = 'done',
      deletedAt = @updatedAt,
      updatedAt = @updatedAt,
      version = @version
    WHERE id = @id
      AND (@version > version OR (@version = version AND @updatedAt > updatedAt))
  `);
  const stmtInsertDeletedPlaceholder = db.prepare(`
    INSERT INTO tasks (
      id, title, description, categoryType, categoryName, priority, dueAt, status, subtasks, deletedAt, updatedAt, version
    ) VALUES (
      @id, '', NULL, 'short_term', 'deleted', 'low', NULL, 'done', '[]', @updatedAt, @updatedAt, @version
    )
    ON CONFLICT(id) DO NOTHING
  `);

  app.post<{
    Body: { tasks?: UpsertTaskInput[]; upserts?: UpsertTaskInput[]; deletions?: DeleteTaskInput[] };
  }>("/sync/tasks", async (request) => {
    const upserts = request.body.upserts ?? request.body.tasks ?? [];
    const deletions = request.body.deletions ?? [];

    const normalizedUpserts: NormalizedUpsertRow[] = upserts.map((item: UpsertTaskInput) => ({
      id: item.id ?? randomUUID(),
      title: item.title ?? "",
      description: item.description ?? null,
      categoryType: item.categoryType ?? "short_term",
      categoryName: item.categoryName ?? "default",
      priority: item.priority ?? "medium",
      dueAt: item.dueAt ?? null,
      dueTime: item.dueTime ?? null,
      status: item.status ?? "todo",
      subtasks: JSON.stringify(normalizeSubtasks(item.subtasks)),
      parentId: item.parentId ?? null,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
      version: item.version ?? 1,
    }));

    const normalizedDeletions = deletions.map((d: DeleteTaskInput) => ({
      id: d.id,
      updatedAt: d.updatedAt ?? new Date().toISOString(),
      version: d.version ?? 1,
    }));

    const tx = db.transaction((items: NormalizedUpsertRow[], removed: DeleteTaskInput[]) => {
      for (const task of items) {
        stmtUpsertTask.run(task);
      }

      for (const deletion of removed) {
        stmtInsertDeletedPlaceholder.run(deletion);
        stmtMarkDeleted.run(deletion);
      }
    });

    tx(normalizedUpserts, normalizedDeletions);
    broadcast("tasks-changed");
    return { acceptedUpserts: normalizedUpserts.length, acceptedDeletions: normalizedDeletions.length };
  });

  app.get<{ Querystring: { since?: string } }>("/tasks", async (request) => {
    const { since } = request.query;
    const rows = since
      ? stmtListLiveSince.all(since)
      : stmtListLive.all();
    return { tasks: buildTaskTree(rows) };
  });

  app.get<{ Querystring: { since?: string } }>("/sync/changes", async (request, reply) => {
    const { since } = request.query;
    if (!since) {
      return reply.code(400).send({ message: "since is required" });
    }

    const rows = stmtListChangedSince.all(since);
    const upserts = buildTaskTree(rows.filter((r) => !r.deletedAt));
    const deletions = rows
      .filter((r) => !!r.deletedAt)
      .map((row) => ({ id: row.id, updatedAt: row.updatedAt, version: row.version }));

    return { upserts, deletions };
  });
};

export { taskRoutes as registerTaskRoutes };