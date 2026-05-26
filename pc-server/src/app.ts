import Fastify from "fastify";
import { registerBeliefRoutes } from "./routes/beliefs.js";
import { registerHabitRoutes } from "./routes/habits.js";
import { registerTaskRoutes } from "./routes/tasks.js";

export function createApp() {
  const app = Fastify({ logger: true });
  const apiKey = process.env.API_KEY ?? "dev-local-key";

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,X-Api-Key");

    if (request.method === "OPTIONS") {
      reply.code(204).send();
      return;
    }

    const value = request.headers["x-api-key"];
    if (value !== apiKey) {
      reply.code(401).send({ message: "unauthorized" });
    }
  });

  app.register(registerTaskRoutes, { prefix: "/api/v1" });
  app.register(registerBeliefRoutes, { prefix: "/api/v1" });
  app.register(registerHabitRoutes, { prefix: "/api/v1" });

  return app;
}