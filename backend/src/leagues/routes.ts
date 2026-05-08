import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { leagues, players, rounds, matches } from "../db/schema.js";
import { generatePartnershipSchedule } from "../scheduler/round-robin.js";
import { matchTeams } from "../scheduler/opponent-matching.js";
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

leagueRoutes.post("/:id/generate", async (c) => {
  const { id } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "draft") {
    return c.json({ error: "Schedule can only be generated for draft leagues" }, 400);
  }

  const leaguePlayers = await db.query.players.findMany({
    where: eq(players.leagueId, id),
  });

  if (leaguePlayers.length < 4) {
    return c.json({ error: "League must have at least 4 players to generate a schedule" }, 400);
  }

  const playerIds = leaguePlayers.map((p) => p.id);
  const schedule = generatePartnershipSchedule(playerIds);
  const standings = new Map<string, number>();

  for (const round of schedule) {
    const [dbRound] = await db
      .insert(rounds)
      .values({ leagueId: id, roundNumber: round.roundNumber })
      .returning();

    const teamResult = matchTeams(round.teams, standings);

    for (const pairing of teamResult.pairings) {
      await db.insert(matches).values({
        roundId: dbRound.id,
        team1Player1: pairing.team1[0],
        team1Player2: pairing.team1[1],
        team2Player1: pairing.team2[0],
        team2Player2: pairing.team2[1],
      });
    }

    if (teamResult.byeTeam) {
      await db.insert(matches).values({
        roundId: dbRound.id,
        team1Player1: teamResult.byeTeam[0],
        team1Player2: teamResult.byeTeam[1],
        isBye: true,
        result: "bye",
      });
    }

    if (round.byePlayer) {
      await db.insert(matches).values({
        roundId: dbRound.id,
        team1Player1: round.byePlayer,
        isBye: true,
        result: "bye",
      });
    }
  }

  await db.update(leagues).set({ status: "active" }).where(eq(leagues.id, id));

  return c.json({ rounds: schedule.length, status: "active" }, 201);
});

leagueRoutes.get("/:id/schedule", async (c) => {
  const { id } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const leagueRounds = await db.query.rounds.findMany({
    where: eq(rounds.leagueId, id),
    with: { matches: true },
    orderBy: (rounds, { asc }) => [asc(rounds.roundNumber)],
  });

  return c.json({ rounds: leagueRounds });
});

leagueRoutes.get("/:id/rounds/:num", async (c) => {
  const { id, num } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const round = await db.query.rounds.findFirst({
    where: and(eq(rounds.leagueId, id), eq(rounds.roundNumber, parseInt(num))),
    with: { matches: true },
  });

  if (!round) {
    return c.json({ error: "Round not found" }, 404);
  }

  return c.json({ round });
});
