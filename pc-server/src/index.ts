import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});