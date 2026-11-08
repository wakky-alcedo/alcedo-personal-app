import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import type { RouteOptions } from "../db.js";

type MemoRow = {
  id: string;
  body: string;
  source_url: string | null;
  source_title: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type MemoWire = {
  id: string;
  body: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type SyncMemoInput = {
  id: string;
  body: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;
/** Separates updated_at and id in a pull cursor. Neither ISO timestamps nor UUIDs contain it. */
const CURSOR_SEPARATOR = "|";

type PullCursor = { updatedAt: string; id: string | null };

/**
 * Pull cursors are "updatedAt|id" so rows sharing an updated_at are never skipped at a page
 * boundary. A bare timestamp (old clients, or `since` alone) keeps the old `updated_at > ts` rule.
 */
export function parsePullCursor(raw: string): PullCursor {
  const at = raw.lastIndexOf(CURSOR_SEPARATOR);
  if (at < 0) return { updatedAt: raw, id: null };
  return { updatedAt: raw.slice(0, at), id: raw.slice(at + 1) };
}

export function formatPullCursor(row: Pick<MemoRow, "updated_at" | "id">): string {
  return `${row.updated_at}${CURSOR_SEPARATOR}${row.id}`;
}

function rowToWire(row: MemoRow): MemoWire {
  return {
    id: row.id,
    body: row.body,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const memoRoutes: FastifyPluginAsync<RouteOptions> = async (app, { db }) => {
  const stmtListActive = db.prepare<[number, number], MemoRow>(`
    SELECT * FROM memos
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  // `id > NULL` is never true, so a cursor without an id behaves as a plain `updated_at > ts`.
  const stmtListSince = db.prepare<{ ts: string; id: string | null; since: string; limit: number }, MemoRow>(`
    SELECT * FROM memos
    WHERE (updated_at > @ts OR (updated_at = @ts AND id > @id))
      AND (deleted_at IS NULL OR deleted_at > @since)
    ORDER BY updated_at ASC, id ASC
    LIMIT @limit
  `);
  const stmtFindById = db.prepare<[string], MemoRow>(`
    SELECT * FROM memos WHERE id = ?
  `);
  const stmtUpsert = db.prepare(`
    INSERT INTO memos (id, body, source_url, source_title, version, created_at, updated_at, deleted_at)
    VALUES (@id, @body, @source_url, @source_title, @version, @created_at, @updated_at, @deleted_at)
    ON CONFLICT(id) DO UPDATE SET
      body = excluded.body,
      source_url = excluded.source_url,
      source_title = excluded.source_title,
      version = excluded.version,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
    WHERE excluded.version > memos.version
      OR (excluded.version = memos.version AND excluded.updated_at > memos.updated_at)
  `);
  const stmtSoftDelete = db.prepare(`
    UPDATE memos SET deleted_at = @deletedAt, updated_at = @updatedAt, version = version + 1
    WHERE id = @id AND deleted_at IS NULL
  `);
  const stmtUpdateBody = db.prepare(`
    UPDATE memos SET body = @body, updated_at = @updatedAt, version = version + 1
    WHERE id = @id AND deleted_at IS NULL
  `);

  app.get<{
    Querystring: { since?: string; limit?: string; cursor?: string };
  }>("/memos", async (request) => {
    const { since, limit: limitStr, cursor } = request.query;
    const limit = Math.min(parseInt(limitStr ?? String(DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    if (since) {
      // Pull sync: memos updated after `since`, paginated by the (updated_at, id) cursor
      const { updatedAt: ts, id } = parsePullCursor(cursor ?? since);
      const rows = stmtListSince.all({ ts, id, since, limit });
      return { memos: rows.map(rowToWire), nextCursor: rows.length === limit ? formatPullCursor(rows[rows.length - 1]) : null };
    }

    // Browse: latest-first, offset-based
    const offset = parseInt(cursor ?? "0", 10) || 0;
    const rows = stmtListActive.all(limit, offset) as MemoRow[];
    return { memos: rows.map(rowToWire), nextCursor: rows.length === limit ? String(offset + limit) : null };
  });

  app.post<{
    Body: { upserts?: SyncMemoInput[]; deletions?: { id: string }[] };
  }>("/sync/memos", async (request) => {
    const upserts = request.body.upserts ?? [];
    const deletions = request.body.deletions ?? [];
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      for (const m of upserts) {
        stmtUpsert.run({
          id: m.id ?? randomUUID(),
          body: m.body ?? "",
          source_url: m.sourceUrl ?? null,
          source_title: m.sourceTitle ?? null,
          version: m.version ?? 1,
          created_at: m.createdAt ?? now,
          updated_at: m.updatedAt ?? now,
          deleted_at: m.deletedAt ?? null,
        });
      }
      for (const d of deletions) {
        stmtSoftDelete.run({ id: d.id, deletedAt: now, updatedAt: now });
      }
    });

    tx();
    return { acceptedUpserts: upserts.length, acceptedDeletions: deletions.length };
  });

  app.patch<{
    Params: { id: string };
    Body: { body: string };
  }>("/memos/:id", async (request, reply) => {
    const existing = stmtFindById.get(request.params.id) as MemoRow | undefined;
    if (!existing || existing.deleted_at) {
      return reply.code(404).send({ message: "not found" });
    }
    const now = new Date().toISOString();
    stmtUpdateBody.run({ id: request.params.id, body: request.body.body, updatedAt: now });
    const updated = stmtFindById.get(request.params.id) as MemoRow;
    return { memo: rowToWire(updated) };
  });

  app.delete<{ Params: { id: string } }>("/memos/:id", async (request, reply) => {
    const existing = stmtFindById.get(request.params.id) as MemoRow | undefined;
    if (!existing || existing.deleted_at) {
      return reply.code(404).send({ message: "not found" });
    }
    const now = new Date().toISOString();
    stmtSoftDelete.run({ id: request.params.id, deletedAt: now, updatedAt: now });
    return { deleted: true };
  });
};

export { memoRoutes as registerMemoRoutes };
