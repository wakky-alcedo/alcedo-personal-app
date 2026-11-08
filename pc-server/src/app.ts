import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerBeliefRoutes } from "./routes/beliefs.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerHabitRoutes } from "./routes/habits.js";
import { registerMemoRoutes } from "./routes/memos.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import type { Db } from "./db.js";

export type AppOptions = { db: Db; apiKey: string | undefined; logger?: boolean };

export async function createApp({ db, apiKey, logger = true }: AppOptions) {
  if (!apiKey) {
    throw new Error("API_KEY environment variable must be set");
  }
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Api-Key"],
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const headerKey = request.headers["x-api-key"];
    const queryKey = (request.query as Record<string, string>)?.key;
    if (headerKey !== apiKey && queryKey !== apiKey) {
      return reply.code(401).send({ message: "unauthorized" });
    }
  });

  app.register(registerTaskRoutes, { prefix: "/api/v1", db });
  app.register(registerBeliefRoutes, { prefix: "/api/v1", db });
  app.register(registerHabitRoutes, { prefix: "/api/v1", db });
  app.register(registerAnalyticsRoutes, { prefix: "/api/v1", db });
  app.register(registerActivityRoutes, { prefix: "/api/v1", db });
  app.register(registerEventRoutes, { prefix: "/api/v1" });
  app.register(registerMemoRoutes, { prefix: "/api/v1", db });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    reply.code(statusCode).send({ statusCode, message: err.message });
  });

  return app;
}