import type { FastifyPluginAsync } from "fastify";

const clients = new Set<(data: string) => void>();

export function broadcast(data: string) {
  for (const send of clients) {
    try { send(data); } catch {}
  }
}

export const registerEventRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });
    reply.raw.write(": connected\n\n");

    const send = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };
    clients.add(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(send);
    });
  });
};
