import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { leagues, trainers, rounds, sets, matches, ffaParticipants } from "../db/schema.js";
import { generatePartnershipSchedule } from "../scheduler/round-robin.js";
import { matchDuos } from "../scheduler/opponent-matching.js";
import { deriveSetResult, computeStandings, type SetData, type FfaPlacement } from "../standings/compute.js";
import { fetchReplayProtocol } from "../parser/fetch-replay.js";
import { parseProtocol } from "../parser/protocol.js";
import type { AuthVariables } from "../types.js";

export const leagueRoutes = new Hono<{ Variables: AuthVariables }>();

leagueRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const userLeagues = await db.query.leagues.findMany({
    where: eq(leagues.createdBy, userId),
    with: { trainers: true },
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
    with: { trainers: true },
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
    with: { sets: true },
  });

  const setIds = leagueRounds.flatMap((r) => r.sets.map((s) => s.id));

  if (setIds.length > 0) {
    await db.delete(ffaParticipants).where(inArray(ffaParticipants.setId, setIds));
    await db.delete(matches).where(inArray(matches.setId, setIds));
    await db.delete(sets).where(inArray(sets.roundId, leagueRounds.map((r) => r.id)));
  }

  await db.delete(rounds).where(eq(rounds.leagueId, id));
  await db.delete(trainers).where(eq(trainers.leagueId, id));
  await db.delete(leagues).where(eq(leagues.id, id));

  return c.json({ success: true });
});

leagueRoutes.post("/:id/trainers", async (c) => {
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
    return c.json({ error: "Trainers can only be added to draft leagues" }, 400);
  }

  const existing = await db.query.trainers.findMany({
    where: eq(trainers.leagueId, id),
  });

  if (existing.length >= 16) {
    return c.json({ error: "League cannot have more than 16 trainers" }, 400);
  }

  const [trainer] = await db
    .insert(trainers)
    .values({ name, showdownName, leagueId: id })
    .returning();

  return c.json({ trainer }, 201);
});

leagueRoutes.delete("/:id/trainers/:tid", async (c) => {
  const { id, tid } = c.req.param();

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  if (league.status !== "draft") {
    return c.json({ error: "Trainers can only be removed from draft leagues" }, 400);
  }

  const trainer = await db.query.trainers.findFirst({
    where: and(eq(trainers.id, tid), eq(trainers.leagueId, id)),
  });

  if (!trainer) {
    return c.json({ error: "Trainer not found" }, 404);
  }

  await db.delete(trainers).where(eq(trainers.id, tid));

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

  const leagueTrainers = await db.query.trainers.findMany({
    where: eq(trainers.leagueId, id),
  });

  if (leagueTrainers.length < 4) {
    return c.json({ error: "League must have at least 4 trainers to generate a schedule" }, 400);
  }

  const trainerIds = leagueTrainers.map((t) => t.id);
  const schedule = generatePartnershipSchedule(trainerIds);
  const standings = new Map<string, number>();
  const byeCounts = new Map<string, number>();

  for (const round of schedule) {
    const [dbRound] = await db
      .insert(rounds)
      .values({ leagueId: id, roundNumber: round.roundNumber })
      .returning();

    const duoResult = matchDuos(round.duos, standings, byeCounts);

    for (const pairing of duoResult.pairings) {
      const [set] = await db
        .insert(sets)
        .values({
          roundId: dbRound.id,
          duo1Trainer1: pairing.duo1[0],
          duo1Trainer2: pairing.duo1[1],
          duo2Trainer1: pairing.duo2[0],
          duo2Trainer2: pairing.duo2[1],
        })
        .returning();

      await db.insert(matches).values([
        { setId: set.id, matchNumber: 1 },
        { setId: set.id, matchNumber: 2 },
        { setId: set.id, matchNumber: 3 },
      ]);
    }

    if (duoResult.byeDuo) {
      for (const t of duoResult.byeDuo) {
        byeCounts.set(t, (byeCounts.get(t) ?? 0) + 1);
      }
      await db.insert(sets).values({
        roundId: dbRound.id,
        duo1Trainer1: duoResult.byeDuo[0],
        duo1Trainer2: duoResult.byeDuo[1],
        isBye: true,
        result: "bye",
      });
    }

    if (round.byeTrainer) {
      byeCounts.set(round.byeTrainer, (byeCounts.get(round.byeTrainer) ?? 0) + 1);
      await db.insert(sets).values({
        roundId: dbRound.id,
        duo1Trainer1: round.byeTrainer,
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
      sets: {
        with: { matches: true },
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
      sets: {
        with: { matches: true },
      },
    },
  });

  if (!round) {
    return c.json({ error: "Round not found" }, 404);
  }

  return c.json({ round });
});

leagueRoutes.patch("/:id/matches/:mid", async (c) => {
  const { id, mid } = c.req.param();
  const body = await c.req.json();
  const { winner, duo1Kos, duo2Kos } = body;

  if (!winner || duo1Kos === undefined || duo2Kos === undefined) {
    return c.json({ error: "winner, duo1Kos, and duo2Kos are required" }, 400);
  }

  if (!["duo1", "duo2", "draw"].includes(winner)) {
    return c.json({ error: "winner must be duo1, duo2, or draw" }, 400);
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

  const [updated] = await db
    .update(matches)
    .set({ winner, duo1Kos, duo2Kos })
    .where(eq(matches.id, mid))
    .returning();

  const setMatches = await db.query.matches.findMany({
    where: eq(matches.setId, match.setId),
  });

  const derived = deriveSetResult(
    setMatches.map((m) => ({
      winner: m.winner as "duo1" | "duo2" | "draw" | null,
      duo1Kos: m.duo1Kos,
      duo2Kos: m.duo2Kos,
    })),
  );

  if (derived) {
    await db.update(sets).set({ result: derived }).where(eq(sets.id, match.setId));
  }

  return c.json({ match: updated, setResult: derived });
});

leagueRoutes.patch("/:id/sets/:sid", async (c) => {
  const { id, sid } = c.req.param();
  const body = await c.req.json();
  const { result, duo1Trainer1, duo1Trainer2, duo2Trainer1, duo2Trainer2 } = body;

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const set = await db.query.sets.findFirst({
    where: eq(sets.id, sid),
  });

  if (!set) {
    return c.json({ error: "Set not found" }, 404);
  }

  const updates: Record<string, string | null> = {};

  if (result) {
    if (!["duo1", "duo2", "draw"].includes(result)) {
      return c.json({ error: "result must be duo1, duo2, or draw" }, 400);
    }
    updates.result = result;
  }

  if (duo1Trainer1 !== undefined) updates.duo1Trainer1 = duo1Trainer1;
  if (duo1Trainer2 !== undefined) updates.duo1Trainer2 = duo1Trainer2;
  if (duo2Trainer1 !== undefined) updates.duo2Trainer1 = duo2Trainer1;
  if (duo2Trainer2 !== undefined) updates.duo2Trainer2 = duo2Trainer2;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400);
  }

  const [updated] = await db
    .update(sets)
    .set(updates)
    .where(eq(sets.id, sid))
    .returning();

  return c.json({ set: updated });
});

leagueRoutes.post("/:id/sets/:sid/matches", async (c) => {
  const { id, sid } = c.req.param();
  const body = await c.req.json();
  const { replayUrl, matchNumber } = body;

  if (!replayUrl || matchNumber === undefined) {
    return c.json({ error: "replayUrl and matchNumber are required" }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, id),
  });

  if (!league) {
    return c.json({ error: "League not found" }, 404);
  }

  const set = await db.query.sets.findFirst({
    where: eq(sets.id, sid),
  });

  if (!set) {
    return c.json({ error: "Set not found" }, 404);
  }

  const match = await db.query.matches.findFirst({
    where: and(eq(matches.setId, sid), eq(matches.matchNumber, matchNumber)),
  });

  if (!match) {
    return c.json({ error: "Match not found" }, 404);
  }

  let protocol: string;
  try {
    protocol = await fetchReplayProtocol(replayUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch replay";
    return c.json({ error: message }, 502);
  }

  const parsed = parseProtocol(protocol);

  const winner = parsed.winner === "draw" ? "draw" : parsed.winner === "p1" ? "duo1" : "duo2";

  const [updated] = await db
    .update(matches)
    .set({
      replayUrl,
      protocol,
      winner,
      duo1Kos: parsed.p1Kos,
      duo2Kos: parsed.p2Kos,
    })
    .where(eq(matches.id, match.id))
    .returning();

  const setMatches = await db.query.matches.findMany({
    where: eq(matches.setId, match.setId),
  });

  const derived = deriveSetResult(
    setMatches.map((m) => ({
      winner: m.winner as "duo1" | "duo2" | "draw" | null,
      duo1Kos: m.duo1Kos,
      duo2Kos: m.duo2Kos,
    })),
  );

  if (derived) {
    await db.update(sets).set({ result: derived }).where(eq(sets.id, match.setId));
  }

  return c.json({ match: updated, setResult: derived });
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
      sets: {
        with: { matches: true },
      },
    },
  });

  const allComplete = leagueRounds.every((r) =>
    r.sets.every((s) => s.isBye || s.result !== null),
  );
  if (!allComplete) {
    return c.json({ error: "All regular round results must be recorded before generating finale" }, 400);
  }

  const allSets: SetData[] = [];
  for (const round of leagueRounds) {
    for (const set of round.sets) {
      allSets.push({
        id: set.id,
        duo1Trainer1: set.duo1Trainer1,
        duo1Trainer2: set.duo1Trainer2,
        duo2Trainer1: set.duo2Trainer1,
        duo2Trainer2: set.duo2Trainer2,
        result: set.result as SetData["result"],
        isBye: set.isBye,
        matches: set.matches.map((m) => ({
          winner: m.winner as "duo1" | "duo2" | "draw" | null,
          duo1Kos: m.duo1Kos,
          duo2Kos: m.duo2Kos,
        })),
      });
    }
  }

  const standings = computeStandings(allSets);
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

  const [finaleSet] = await db
    .insert(sets)
    .values({
      roundId: finaleRound.id,
      setType: "ffa",
      bestOf: 1,
    })
    .returning();

  await db.insert(matches).values({ setId: finaleSet.id, matchNumber: 1 });

  const participantValues = top4.map((s) => ({
    setId: finaleSet.id,
    trainerId: s.trainerId,
  }));
  await db.insert(ffaParticipants).values(participantValues);

  await db.update(leagues).set({ status: "finale" }).where(eq(leagues.id, id));

  return c.json({
    finaleRound,
    participants: top4.map((s) => s.trainerId),
  }, 201);
});

leagueRoutes.patch("/:id/sets/:sid/placements", async (c) => {
  const { id, sid } = c.req.param();
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

  const set = await db.query.sets.findFirst({
    where: eq(sets.id, sid),
  });

  if (!set) {
    return c.json({ error: "Set not found" }, 404);
  }

  if (set.setType !== "ffa") {
    return c.json({ error: "Placements can only be recorded for FFA sets" }, 400);
  }

  for (const p of placements) {
    await db
      .update(ffaParticipants)
      .set({ placement: p.placement })
      .where(
        and(
          eq(ffaParticipants.setId, sid),
          eq(ffaParticipants.trainerId, p.trainerId),
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
      sets: {
        with: { matches: true, ffaParticipants: true },
      },
    },
  });

  const allSets: SetData[] = [];
  const allFfaPlacements: FfaPlacement[] = [];
  for (const round of leagueRounds) {
    for (const set of round.sets) {
      allSets.push({
        id: set.id,
        duo1Trainer1: set.duo1Trainer1,
        duo1Trainer2: set.duo1Trainer2,
        duo2Trainer1: set.duo2Trainer1,
        duo2Trainer2: set.duo2Trainer2,
        result: set.result as SetData["result"],
        isBye: set.isBye,
        matches: set.matches.map((m) => ({
          winner: m.winner as "duo1" | "duo2" | "draw" | null,
          duo1Kos: m.duo1Kos,
          duo2Kos: m.duo2Kos,
        })),
      });

      if (set.ffaParticipants) {
        for (const fp of set.ffaParticipants) {
          allFfaPlacements.push({
            trainerId: fp.trainerId,
            placement: fp.placement,
          });
        }
      }
    }
  }

  const standings = computeStandings(allSets, allFfaPlacements);

  const trainerList = await db.query.trainers.findMany({
    where: eq(trainers.leagueId, id),
  });
  const trainerMap = new Map(trainerList.map((t) => [t.id, t]));

  const enriched = standings.map((s) => ({
    ...s,
    trainerName: trainerMap.get(s.trainerId)?.name ?? s.trainerId,
    showdownName: trainerMap.get(s.trainerId)?.showdownName ?? "",
  }));

  return c.json({ standings: enriched });
});
