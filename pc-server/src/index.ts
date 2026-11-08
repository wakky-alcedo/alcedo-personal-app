import { createApp } from "./app.js";
import { openDatabase, resolveDbPath } from "./db.js";

const port = Number(process.env.PORT ?? 8787);
const db = openDatabase(resolveDbPath());

createApp({ db, apiKey: process.env.API_KEY }).then((app) => {
  app.listen({ port, host: "0.0.0.0" }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
});
