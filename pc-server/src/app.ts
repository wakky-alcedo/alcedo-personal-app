import cors from "@fastify/cors";
import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyServerOptions } from "fastify";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerBeliefRoutes } from "./routes/beliefs.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerHabitRoutes } from "./routes/habits.js";
import { registerMemoRoutes } from "./routes/memos.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import type { Db } from "./db.js";

/** EventSource cannot send headers, so only the SSE stream accepts the key as `?key=`. */
const QUERY_KEY_PATHS = new Set(["/api/v1/events"]);

function keyMatches(candidate: unknown, apiKey: string): boolean {
  if (typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(apiKey);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Masks `key=` query values so the API key never lands in request logs. */
export function redactUrl(url: string): string {
  return url.replace(/([?&]key=)[^&]*/g, "$1***");
}

export type AppOptions = { db: Db; apiKey: string | undefined; logger?: boolean };

export async function createApp({ db, apiKey, logger = true }: AppOptions) {
  if (!apiKey) {
    throw new Error("API_KEY environment variable must be set");
  }
  const loggerOptions: FastifyServerOptions["logger"] = logger
    ? { serializers: { req: (req) => ({ method: req.method, url: redactUrl(req.url), remoteAddress: req.ip }) } }
    : false;
  const app = Fastify({ logger: loggerOptions });

  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Api-Key"],
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;

    const path = request.url.split("?")[0];
    const queryKey = QUERY_KEY_PATHS.has(path) ? (request.query as Record<string, unknown>)?.key : undefined;
    if (!keyMatches(request.headers["x-api-key"], apiKey) && !keyMatches(queryKey, apiKey)) {
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