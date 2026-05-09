import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { leagues, players, rounds, matches, games, ffaParticipants } from "../db/schema.js";
import { generatePartnershipSchedule } from "../scheduler/round-robin.js";
import { matchTeams } from "../scheduler/opponent-matching.js";
import { deriveMatchResult, computeStandings, type MatchData, type FfaPlacement } from "../standings/compute.js";
import { fetchReplayProtocol } from "../parser/fetch-replay.js";
import { parseProtocol } from "../parser/protocol.js";
import type { AuthVariables } from "../types.js";

export const leagueRoutes = new Hono<{ Variables: AuthVariables }>();

leagueRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const userLeagues = await db.query.leagues.findMany({
    where: eq(leagues.createdBy, userId),
    with: { players: true },
  });
  return c.json({ leagues: userLeagues });
});

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

leagueRoutes.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, format } = body;

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (format) updates.format = format;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const [updated] = await db
    .update(leagues)
    .set(updates)
    .where(eq(leagues.id, id))
    .returning();

  return c.json({ league: updated });
});

leagueRoutes.delete("/:id", async (c) => {
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
  });

  const matchIds = leagueRounds.flatMap((r) => r.matches.map((m) => m.id));

  if (matchIds.length > 0) {
    await db.delete(ffaParticipants).where(inArray(ffaParticipants.matchId, matchIds));
    await db.delete(games).where(inArray(games.matchId, matchIds));
    await db.delete(matches).where(inArray(matches.roundId, leagueRounds.map((r) => r.id)));
  }

  await db.delete(rounds).where(eq(rounds.leagueId, id));
  await db.delete(players).where(eq(players.leagueId, id));
  await db.delete(leagues).where(eq(leagues.id, id));

  return c.json({ success: true });
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
  const byeCounts = new Map<string, number>();

  for (const round of schedule) {
    const [dbRound] = await db
      .insert(rounds)
      .values({ leagueId: id, roundNumber: round.roundNumber })
      .returning();

    const teamResult = matchTeams(round.teams, standings, byeCounts);

    for (const pairing of teamResult.pairings) {
      const [match] = await db
        .insert(matches)
        .values({
          roundId: dbRound.id,
          team1Player1: pairing.team1[0],
          team1Player2: pairing.team1[1],
          team2Player1: pairing.team2[0],
          team2Player2: pairing.team2[1],
        })
        .returning();

      await db.insert(games).values([
        { matchId: match.id, gameNumber: 1 },
        { matchId: match.id, gameNumber: 2 },
        { matchId: match.id, gameNumber: 3 },
      ]);
    }

    if (teamResult.byeTeam) {
      for (const p of teamResult.byeTeam) {
        byeCounts.set(p, (byeCounts.get(p) ?? 0) + 1);
      }
      await db.insert(matches).values({
        roundId: dbRound.id,
        team1Player1: teamResult.byeTeam[0],
        team1Player2: teamResult.byeTeam[1],
        isBye: true,
        result: "bye",
      });
    }

    if (round.byePlayer) {
      byeCounts.set(round.byePlayer, (byeCounts.get(round.byePlayer) ?? 0) + 1);
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
    with: {
      matches: {
        with: { games: true },
      },
    },
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
    with: {
      matches: {
        with: { games: true },
      },
    },
  });

  if (!round) {
    return c.json({ error: "Round not found" }, 404);
  }

  return c.json({ round });
});

leagueRoutes.patch("/:id/games/:gid", async (c) => {
  const { id, gid } = c.req.param();
  const body = await c.req.json();
  const { winner, team1Kos, team2Kos } = body;

  if (!winner || team1Kos === undefined || team2Kos === undefined) {
    return c.json({ error: "winner, team1Kos, and team2Kos are required" }, 400);
  }

  if (!["team1", "team2", "draw"].includes(winner)) {
    return c.json({ error: "winner must be team1, team2, or draw" }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const game = await db.query.games.findFirst({
    where: eq(games.id, gid),
  });

  if (!game) {
    return c.json({ error: "Game not found" }, 404);
  }

  const [updated] = await db
    .update(games)
    .set({ winner, team1Kos, team2Kos })
    .where(eq(games.id, gid))
    .returning();

  const matchGames = await db.query.games.findMany({
    where: eq(games.matchId, game.matchId),
  });

  const derived = deriveMatchResult(
    matchGames.map((g) => ({
      winner: g.winner as "team1" | "team2" | "draw" | null,
      team1Kos: g.team1Kos,
      team2Kos: g.team2Kos,
    })),
  );

  if (derived) {
    await db.update(matches).set({ result: derived }).where(eq(matches.id, game.matchId));
  }

  return c.json({ game: updated, matchResult: derived });
});

leagueRoutes.patch("/:id/matches/:mid", async (c) => {
  const { id, mid } = c.req.param();
  const body = await c.req.json();
  const { result, team1Player1, team1Player2, team2Player1, team2Player2 } = body;

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, mid),
  });

  if (!match) {
    return c.json({ error: "Match not found" }, 404);
  }

  const updates: Record<string, string | null> = {};

  if (result) {
    if (!["team1", "team2", "draw"].includes(result)) {
      return c.json({ error: "result must be team1, team2, or draw" }, 400);
    }
    updates.result = result;
  }

  if (team1Player1 !== undefined) updates.team1Player1 = team1Player1;
  if (team1Player2 !== undefined) updates.team1Player2 = team1Player2;
  if (team2Player1 !== undefined) updates.team2Player1 = team2Player1;
  if (team2Player2 !== undefined) updates.team2Player2 = team2Player2;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const [updated] = await db
    .update(matches)
    .set(updates)
    .where(eq(matches.id, mid))
    .returning();

  return c.json({ match: updated });
});

leagueRoutes.post("/:id/matches/:mid/games", async (c) => {
  const { id, mid } = c.req.param();
  const body = await c.req.json();
  const { replayUrl, gameNumber } = body;

  if (!replayUrl || gameNumber === undefined) {
    return c.json({ error: "replayUrl and gameNumber are required" }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, mid),
  });

  if (!match) {
    return c.json({ error: "Match not found" }, 404);
  }

  const game = await db.query.games.findFirst({
    where: and(eq(games.matchId, mid), eq(games.gameNumber, gameNumber)),
  });

  if (!game) {
    return c.json({ error: "Game not found" }, 404);
  }

  let protocol: string;
  try {
    protocol = await fetchReplayProtocol(replayUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch replay";
    return c.json({ error: message }, 502);
  }

  const parsed = parseProtocol(protocol);

  const winner = parsed.winner === "draw" ? "draw" : parsed.winner === "p1" ? "team1" : "team2";

  const [updated] = await db
    .update(games)
    .set({
      replayUrl,
      protocol,
      winner,
      team1Kos: parsed.p1Kos,
      team2Kos: parsed.p2Kos,
    })
    .where(eq(games.id, game.id))
    .returning();

  const matchGames = await db.query.games.findMany({
    where: eq(games.matchId, game.matchId),
  });

  const derived = deriveMatchResult(
    matchGames.map((g) => ({
      winner: g.winner as "team1" | "team2" | "draw" | null,
      team1Kos: g.team1Kos,
      team2Kos: g.team2Kos,
    })),
  );

  if (derived) {
    await db.update(matches).set({ result: derived }).where(eq(matches.id, game.matchId));
  }

  return c.json({ game: updated, matchResult: derived });
});

leagueRoutes.post("/:id/finale", async (c) => {
  const { id } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "active") {
    return c.json({ error: "Finale can only be generated for active leagues" }, 400);
  }

  const leagueRounds = await db.query.rounds.findMany({
    where: eq(rounds.leagueId, id),
    with: {
      matches: {
        with: { games: true },
      },
    },
  });

  const allComplete = leagueRounds.every((r) =>
    r.matches.every((m) => m.isBye || m.result !== null),
  );
  if (!allComplete) {
    return c.json({ error: "All regular round results must be recorded before generating finale" }, 400);
  }

  const allMatches: MatchData[] = [];
  for (const round of leagueRounds) {
    for (const match of round.matches) {
      allMatches.push({
        id: match.id,
        team1Player1: match.team1Player1,
        team1Player2: match.team1Player2,
        team2Player1: match.team2Player1,
        team2Player2: match.team2Player2,
        result: match.result as MatchData["result"],
        isBye: match.isBye,
        games: match.games.map((g) => ({
          winner: g.winner as "team1" | "team2" | "draw" | null,
          team1Kos: g.team1Kos,
          team2Kos: g.team2Kos,
        })),
      });
    }
  }

  const standings = computeStandings(allMatches);
  const top4 = standings.slice(0, 4);

  const nextRoundNumber = leagueRounds.length + 1;
  const [finaleRound] = await db
    .insert(rounds)
    .values({
      leagueId: id,
      roundNumber: nextRoundNumber,
      roundType: "finale",
    })
    .returning();

  const [finaleMatch] = await db
    .insert(matches)
    .values({
      roundId: finaleRound.id,
      matchType: "ffa",
      bestOf: 1,
    })
    .returning();

  await db.insert(games).values({ matchId: finaleMatch.id, gameNumber: 1 });

  const participantValues = top4.map((s) => ({
    matchId: finaleMatch.id,
    playerId: s.playerId,
  }));
  await db.insert(ffaParticipants).values(participantValues);

  await db.update(leagues).set({ status: "finale" }).where(eq(leagues.id, id));

  return c.json({
    finaleRound,
    participants: top4.map((s) => s.playerId),
  }, 201);
});

leagueRoutes.patch("/:id/matches/:mid/placements", async (c) => {
  const { id, mid } = c.req.param();
  const body = await c.req.json();
  const { placements } = body;

  if (!placements || !Array.isArray(placements)) {
    return c.json({ error: "placements array is required" }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "finale") {
    return c.json({ error: "Placements can only be recorded for leagues in finale status" }, 400);
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, mid),
  });

  if (!match) {
    return c.json({ error: "Match not found" }, 404);
  }

  if (match.matchType !== "ffa") {
    return c.json({ error: "Placements can only be recorded for FFA matches" }, 400);
  }

  for (const p of placements) {
    await db
      .update(ffaParticipants)
      .set({ placement: p.placement })
      .where(
        and(
          eq(ffaParticipants.matchId, mid),
          eq(ffaParticipants.playerId, p.playerId),
        ),
      );
  }

  await db.update(leagues).set({ status: "complete" }).where(eq(leagues.id, id));

  return c.json({ success: true });
});

leagueRoutes.get("/:id/standings", async (c) => {
  const { id } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const leagueRounds = await db.query.rounds.findMany({
    where: eq(rounds.leagueId, id),
    with: {
      matches: {
        with: { games: true, ffaParticipants: true },
      },
    },
  });

  const allMatches: MatchData[] = [];
  const allFfaPlacements: FfaPlacement[] = [];
  for (const round of leagueRounds) {
    for (const match of round.matches) {
      allMatches.push({
        id: match.id,
        team1Player1: match.team1Player1,
        team1Player2: match.team1Player2,
        team2Player1: match.team2Player1,
        team2Player2: match.team2Player2,
        result: match.result as MatchData["result"],
        isBye: match.isBye,
        games: match.games.map((g) => ({
          winner: g.winner as "team1" | "team2" | "draw" | null,
          team1Kos: g.team1Kos,
          team2Kos: g.team2Kos,
        })),
      });

      if (match.ffaParticipants) {
        for (const fp of match.ffaParticipants) {
          allFfaPlacements.push({
            playerId: fp.playerId,
            placement: fp.placement,
          });
        }
      }
    }
  }

  const standings = computeStandings(allMatches, allFfaPlacements);

  const playerList = await db.query.players.findMany({
    where: eq(players.leagueId, id),
  });
  const playerMap = new Map(playerList.map((p) => [p.id, p]));

  const enriched = standings.map((s) => ({
    ...s,
    playerName: playerMap.get(s.playerId)?.name ?? s.playerId,
    showdownName: playerMap.get(s.playerId)?.showdownName ?? "",
  }));

  return c.json({ standings: enriched });
});
