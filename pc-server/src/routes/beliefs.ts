import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db.js";

type BeliefInput = {
  id: string;
  text: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type DeleteBeliefInput = {
  id: string;
};

const beliefRoutes: FastifyPluginAsync = async (app) => {
  app.get("/beliefs", async () => {
    const beliefs = db.prepare("SELECT * FROM beliefs ORDER BY updatedAt DESC").all().map((belief: any) => ({
      ...belief,
      isActive: Boolean(belief.isActive),
    }));
    return { beliefs };
  });

  app.post<{
    Body: { beliefs?: BeliefInput[]; upserts?: BeliefInput[]; deletions?: DeleteBeliefInput[] };
  }>("/sync/beliefs", async (request) => {
    const upserts = request.body.upserts ?? request.body.beliefs ?? [];
    const deletions = request.body.deletions ?? [];

    const normalizedUpserts = upserts.map((item: any) => ({
      id: item.id ?? randomUUID(),
      text: item.text ?? "",
      isActive: item.isActive ?? true,
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    }));

    const insertBelief = db.prepare(`
      INSERT INTO beliefs (id, text, isActive, createdAt, updatedAt)
      VALUES (@id, @text, @isActive, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        isActive = excluded.isActive,
        updatedAt = excluded.updatedAt
    `);

    const deleteBelief = db.prepare("DELETE FROM beliefs WHERE id = ?");

    const tx = db.transaction((items: BeliefInput[], removed: DeleteBeliefInput[]) => {
      for (const belief of items) {
        insertBelief.run({ ...belief, isActive: belief.isActive ? 1 : 0 });
      }

      for (const deletion of removed) {
        deleteBelief.run(deletion.id);
      }
    });

    tx(normalizedUpserts, deletions);
    return { acceptedUpserts: normalizedUpserts.length, acceptedDeletions: deletions.length };
  });

  app.post<{
    Body: BeliefInput;
  }>("/beliefs", async (request) => {
    const belief = {
      id: request.body.id ?? randomUUID(),
      text: request.body.text ?? "",
      isActive: request.body.isActive ?? true,
      createdAt: request.body.createdAt ?? new Date().toISOString(),
      updatedAt: request.body.updatedAt ?? new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO beliefs (id, text, isActive, createdAt, updatedAt)
      VALUES (@id, @text, @isActive, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        isActive = excluded.isActive,
        updatedAt = excluded.updatedAt
    `).run({ ...belief, isActive: belief.isActive ? 1 : 0 });

    return { belief };
  });

  app.delete<{ Params: { id: string } }>("/beliefs/:id", async (request) => {
    db.prepare("DELETE FROM beliefs WHERE id = ?").run(request.params.id);
    return { deleted: true };
  });
};

export { beliefRoutes as registerBeliefRoutes };