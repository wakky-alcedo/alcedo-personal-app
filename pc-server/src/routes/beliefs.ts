import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import type { RouteOptions } from "../db.js";

type BeliefRow = {
  id: string;
  text: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type BeliefRecord = { id: string; text: string; isActive: boolean; createdAt: string; updatedAt: string };

/** Narrows an unknown request item into a storable belief, or null when `text` is missing. */
function parseBelief(input: unknown, now: string): BeliefRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (!text) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : randomUUID(),
    text,
    isActive: item.isActive !== false,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

function toWire({ deletedAt: _deletedAt, ...row }: BeliefRow) {
  return { ...row, isActive: Boolean(row.isActive) };
}

const beliefRoutes: FastifyPluginAsync<RouteOptions> = async (app, { db }) => {
  const stmtList = db.prepare<[], BeliefRow>("SELECT * FROM beliefs WHERE deletedAt IS NULL ORDER BY updatedAt DESC");
  const stmtFind = db.prepare<[string], BeliefRow>("SELECT * FROM beliefs WHERE id = ?");
  // Deleted beliefs are never resurrected by an upsert (WHERE clause on the conflict update).
  const stmtUpsert = db.prepare(`
    INSERT INTO beliefs (id, text, isActive, createdAt, updatedAt)
    VALUES (@id, @text, @isActive, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      isActive = excluded.isActive,
      updatedAt = excluded.updatedAt
    WHERE beliefs.deletedAt IS NULL
  `);
  const stmtSoftDelete = db.prepare("UPDATE beliefs SET deletedAt = @now, updatedAt = @now WHERE id = @id AND deletedAt IS NULL");

  function save(belief: BeliefRecord) {
    stmtUpsert.run({ ...belief, isActive: belief.isActive ? 1 : 0 });
  }

  app.get("/beliefs", async () => ({ beliefs: stmtList.all().map(toWire) }));

  app.post<{ Body: { beliefs?: unknown[]; upserts?: unknown[]; deletions?: unknown[] } | undefined }>("/sync/beliefs", async (request) => {
    const now = new Date().toISOString();
    const upserts = (request.body?.upserts ?? request.body?.beliefs ?? [])
      .map((item) => parseBelief(item, now))
      .filter((item): item is BeliefRecord => item !== null);
    const deletionIds = (request.body?.deletions ?? [])
      .map((d) => (d && typeof d === "object" ? (d as Record<string, unknown>).id : undefined))
      .filter((id): id is string => typeof id === "string");

    db.transaction(() => {
      for (const belief of upserts) save(belief);
      for (const id of deletionIds) stmtSoftDelete.run({ id, now });
    })();
    return { acceptedUpserts: upserts.length, acceptedDeletions: deletionIds.length };
  });

  app.post<{ Body: unknown }>("/beliefs", async (request, reply) => {
    const belief = parseBelief(request.body, new Date().toISOString());
    if (!belief) return reply.code(400).send({ message: "text is required" });
    if (stmtFind.get(belief.id)?.deletedAt) return reply.code(404).send({ message: "belief was deleted" });
    save(belief);
    return { belief: toWire(stmtFind.get(belief.id)!) };
  });

  app.delete<{ Params: { id: string } }>("/beliefs/:id", async (request) => {
    stmtSoftDelete.run({ id: request.params.id, now: new Date().toISOString() });
    return { deleted: true };
  });
};

export { beliefRoutes as registerBeliefRoutes };
