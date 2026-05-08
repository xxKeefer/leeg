import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./auth/routes.js";
import { authMiddleware } from "./auth/middleware.js";
import { leagueRoutes } from "./leagues/routes.js";
import type { AuthVariables } from "./types.js";

const app = new Hono<{ Variables: AuthVariables }>().basePath("/api");

app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/auth", authRoutes);

app.use("/protected/*", authMiddleware);
app.get("/protected/me", (c) => {
  return c.json({ userId: c.get("userId") });
});

app.use("/leagues/*", authMiddleware);
app.route("/leagues", leagueRoutes);

export default app;
