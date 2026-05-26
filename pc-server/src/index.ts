import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);

createApp().then((app) => {
  app.listen({ port, host: "0.0.0.0" }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
});