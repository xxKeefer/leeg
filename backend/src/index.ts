import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "./db/index.js";
import app from "./app.js";

const port = Number(process.env.PORT) || 3000;

await migrate(getDb(), { migrationsFolder: "./drizzle" });
console.log("Migrations applied");

serve({ fetch: app.fetch, port }, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
