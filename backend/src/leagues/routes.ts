import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { leagues, players } from "../db/schema.js";
import type { AuthVariables } from "../types.js";

export const leagueRoutes = new Hono<{ Variables: AuthVariables }>();

leagueRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { name } = body;

  if (!name) {
    return c.json({ error: "League name is required" }, 400);
  }

  const userId = c.get("userId");
  const [league] = await db
    .insert(leagues)
    .values({ name, createdBy: userId })
    .returning();

  return c.json({ league }, 201);
});

leagueRoutes.get("/:id", async (c) => {
  const { id } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
    with: { players: true },
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  return c.json({ league });
});

leagueRoutes.post("/:id/players", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, showdownName } = body;

  if (!name || !showdownName) {
    return c.json({ error: "Name and showdownName are required" }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "draft") {
    return c.json({ error: "Players can only be added to draft leagues" }, 400);
  }

  const existing = await db.query.players.findMany({
    where: eq(players.leagueId, id),
  });

  if (existing.length >= 16) {
    return c.json({ error: "League cannot have more than 16 players" }, 400);
  }

  const [player] = await db
    .insert(players)
    .values({ name, showdownName, leagueId: id })
    .returning();

  return c.json({ player }, 201);
});

leagueRoutes.delete("/:id/players/:pid", async (c) => {
  const { id, pid } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "draft") {
    return c.json({ error: "Players can only be removed from draft leagues" }, 400);
  }

  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pid), eq(players.leagueId, id)),
  });

  if (!player) {
    return c.json({ error: "Player not found" }, 404);
  }

  await db.delete(players).where(eq(players.id, pid));

  return c.json({ success: true });
});
