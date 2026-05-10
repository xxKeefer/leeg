import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { leagueRoutes } from "./routes.js";
import type { AuthVariables } from "../types.js";

const { mockReturning, mockSet, mockUpdateWhere, mockFetchReplay } = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockSet: vi.fn(),
  mockFetchReplay: vi.fn(),
}));

vi.mock("../parser/fetch-replay.js", () => ({
  fetchReplayProtocol: mockFetchReplay,
}));

vi.mock("../db/index.js", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: mockReturning,
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: mockSet,
    }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    query: {
      leagues: {
        findFirst: vi.fn(),
      },
      trainers: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      rounds: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      sets: {
        findFirst: vi.fn(),
      },
      matches: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      ffaParticipants: {
        findMany: vi.fn(),
      },
    },
  },
}));

import { db } from "../db/index.js";

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", async (c, next) => {
    c.set("userId", "user-1");
    await next();
  });
  app.route("/leagues", leagueRoutes);
  return app;
}

describe("league routes", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    mockUpdateWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
  });

  describe("POST /leagues", () => {
    it("creates a league and returns 201", async () => {
      const mockLeague = { id: "league-1", name: "Season 1", format: "2hg", status: "draft" };
      mockReturning.mockResolvedValue([mockLeague]);

      const res = await app.request("/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Season 1" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.league.name).toBe("Season 1");
      expect(body.league.status).toBe("draft");
    });

    it("rejects missing name with 400", async () => {
      const res = await app.request("/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /leagues/:id", () => {
    it("returns league with trainers", async () => {
      const mockLeague = {
        id: "league-1",
        name: "Season 1",
        format: "2hg",
        status: "draft",
        trainers: [{ id: "t-1", name: "Ash", showdownName: "ash_ketchum" }],
      };
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLeague);

      const res = await app.request("/leagues/league-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.league.name).toBe("Season 1");
      expect(body.league.trainers).toHaveLength(1);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/trainers", () => {
    it("enrolls a trainer and returns 201", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const mockTrainer = {
        id: "t-1",
        name: "Ash",
        showdownName: "ash_ketchum",
        leagueId: "league-1",
      };
      mockReturning.mockResolvedValue([mockTrainer]);

      const res = await app.request("/leagues/league-1/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.trainer.name).toBe("Ash");
      expect(body.trainer.showdownName).toBe("ash_ketchum");
    });

    it("rejects missing fields with 400", async () => {
      const res = await app.request("/leagues/league-1/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects enrollment for non-draft league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });

      const res = await app.request("/leagues/league-1/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects enrollment beyond 16 trainers with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      const sixteenTrainers = Array.from({ length: 16 }, (_, i) => ({
        id: `t-${i}`,
        name: `Trainer ${i}`,
      }));
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(sixteenTrainers);

      const res = await app.request("/leagues/league-1/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Trainer 17", showdownName: "t17" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/16/);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /leagues/:id/trainers/:tid", () => {
    it("removes a trainer and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.trainers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "t-1",
        name: "Ash",
        leagueId: "league-1",
      });

      const res = await app.request("/leagues/league-1/trainers/t-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });

    it("rejects removal from non-draft league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });

      const res = await app.request("/leagues/league-1/trainers/t-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent trainer", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.trainers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/trainers/t-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/trainers/t-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/generate", () => {
    it("generates schedule and returns 201", async () => {
      const leagueTrainers = [
        { id: "t-1", name: "A" },
        { id: "t-2", name: "B" },
        { id: "t-3", name: "C" },
        { id: "t-4", name: "D" },
      ];
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(leagueTrainers);
      mockReturning.mockResolvedValue([{ id: "round-1", roundNumber: 1 }]);

      const res = await app.request("/leagues/league-1/generate", {
        method: "POST",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.rounds).toBe(3);
    });

    it("rejects non-draft league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });

      const res = await app.request("/leagues/league-1/generate", { method: "POST" });

      expect(res.status).toBe(400);
    });

    it("rejects fewer than 4 trainers with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "t-1", name: "A" },
        { id: "t-2", name: "B" },
        { id: "t-3", name: "C" },
      ]);

      const res = await app.request("/leagues/league-1/generate", { method: "POST" });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/4/);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/generate", { method: "POST" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /leagues/:id/schedule", () => {
    it("returns schedule with rounds and sets", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        name: "Season 1",
      });
      (db.query.rounds.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "r-1",
          roundNumber: 1,
          roundType: "regular",
          status: "pending",
          sets: [
            {
              id: "s-1",
              duo1Trainer1: "t-1",
              duo1Trainer2: "t-2",
              duo2Trainer1: "t-3",
              duo2Trainer2: "t-4",
              isBye: false,
            },
          ],
        },
      ]);

      const res = await app.request("/leagues/league-1/schedule");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rounds).toHaveLength(1);
      expect(body.rounds[0].sets).toHaveLength(1);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/schedule");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /leagues/:id/rounds/:num", () => {
    it("returns a single round detail", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
      });
      (db.query.rounds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "r-1",
        roundNumber: 1,
        roundType: "regular",
        status: "pending",
        sets: [
          {
            id: "s-1",
            duo1Trainer1: "t-1",
            duo1Trainer2: "t-2",
            duo2Trainer1: "t-3",
            duo2Trainer2: "t-4",
            isBye: false,
          },
        ],
      });

      const res = await app.request("/leagues/league-1/rounds/1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.round.roundNumber).toBe(1);
      expect(body.round.sets).toHaveLength(1);
    });

    it("returns 404 for non-existent round", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
      });
      (db.query.rounds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/rounds/99");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /leagues/:id/matches/:mid", () => {
    it("updates a match result and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        setId: "s-1",
        matchNumber: 1,
      });
      const updatedMatch = {
        id: "m-1",
        setId: "s-1",
        matchNumber: 1,
        winner: "duo1",
        duo1Kos: 3,
        duo2Kos: 1,
      };
      mockReturning.mockResolvedValue([updatedMatch]);
      (db.query.matches.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
      ]);

      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "duo1", duo1Kos: 3, duo2Kos: 1 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.match.winner).toBe("duo1");
    });

    it("auto-derives set result when duo wins 2 matches", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-2",
        setId: "s-1",
        matchNumber: 2,
      });
      mockReturning.mockResolvedValue([
        { id: "m-2", setId: "s-1", matchNumber: 2, winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
      ]);
      (db.query.matches.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
        { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/matches/m-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "duo1", duo1Kos: 3, duo2Kos: 0 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.setResult).toBe("duo1");
    });

    it("rejects missing fields with 400", async () => {
      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "duo1" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects invalid winner with 400", async () => {
      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "invalid", duo1Kos: 0, duo2Kos: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "duo1", duo1Kos: 3, duo2Kos: 1 }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent match", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "duo1", duo1Kos: 3, duo2Kos: 1 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /leagues/:id/sets/:sid", () => {
    it("overrides a set result and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        roundId: "r-1",
      });
      const updated = { id: "s-1", result: "duo2" };
      mockReturning.mockResolvedValue([updated]);

      const res = await app.request("/leagues/league-1/sets/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "duo2" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.set.result).toBe("duo2");
    });

    it("rejects invalid result with 400", async () => {
      const res = await app.request("/leagues/league-1/sets/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "invalid" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "duo1" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent set", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "duo1" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /leagues/:id/standings", () => {
    it("returns standings with trainer info", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.rounds.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "r-1",
          roundNumber: 1,
          sets: [
            {
              id: "s-1",
              duo1Trainer1: "t-1",
              duo1Trainer2: "t-2",
              duo2Trainer1: "t-3",
              duo2Trainer2: "t-4",
              result: "duo1",
              isBye: false,
              matches: [
                { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
                { winner: "duo1", duo1Kos: 2, duo2Kos: 0 },
              ],
              ffaParticipants: [],
            },
          ],
        },
      ]);
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "t-1", name: "Ash", showdownName: "ash_k" },
        { id: "t-2", name: "Brock", showdownName: "brock_r" },
        { id: "t-3", name: "Misty", showdownName: "misty_w" },
        { id: "t-4", name: "Gary", showdownName: "gary_o" },
      ]);

      const res = await app.request("/leagues/league-1/standings");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.standings).toHaveLength(4);
      expect(body.standings[0].points).toBe(3);
      expect(body.standings[0].trainerName).toBe("Ash");
      expect(body.standings[2].points).toBe(0);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/standings");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/sets/:sid/matches", () => {
    it("submits replay URL and auto-populates match result", async () => {
      const protocol = "|player|p1|Alice|\n|player|p2|Bob|\n|faint|p2a: Pikachu\n|faint|p2a: Charizard\n|win|Alice";
      mockFetchReplay.mockResolvedValue(protocol);

      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        roundId: "r-1",
        duo1Trainer1: "t-1",
        duo1Trainer2: "t-2",
        duo2Trainer1: "t-3",
        duo2Trainer2: "t-4",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        setId: "s-1",
        matchNumber: 1,
      });
      const updatedMatch = {
        id: "m-1",
        setId: "s-1",
        matchNumber: 1,
        replayUrl: "https://replay.pokemonshowdown.com/gen9doublesou-12345",
        protocol,
        winner: "duo1",
        duo1Kos: 2,
        duo2Kos: 0,
      };
      mockReturning.mockResolvedValue([updatedMatch]);
      (db.query.matches.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "duo1", duo1Kos: 2, duo2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/gen9doublesou-12345",
          matchNumber: 1,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.match.winner).toBe("duo1");
      expect(body.match.duo1Kos).toBe(2);
      expect(body.match.duo2Kos).toBe(0);
      expect(body.match.replayUrl).toBe("https://replay.pokemonshowdown.com/gen9doublesou-12345");
    });

    it("returns 400 for missing replayUrl", async () => {
      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchNumber: 1 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing matchNumber", async () => {
      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replayUrl: "https://replay.pokemonshowdown.com/test-123" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          matchNumber: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent set", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          matchNumber: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent match", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        roundId: "r-1",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          matchNumber: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 502 when replay fetch fails", async () => {
      mockFetchReplay.mockRejectedValue(new Error("Failed to fetch replay: 404"));

      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        roundId: "r-1",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        setId: "s-1",
        matchNumber: 1,
      });

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          matchNumber: 1,
        }),
      });

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/fetch/i);
    });

    it("auto-derives set result when enough matches recorded", async () => {
      const protocol = "|player|p1|Alice|\n|player|p2|Bob|\n|win|Alice";
      mockFetchReplay.mockResolvedValue(protocol);

      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        roundId: "r-1",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-2",
        setId: "s-1",
        matchNumber: 2,
      });
      mockReturning.mockResolvedValue([
        { id: "m-2", setId: "s-1", matchNumber: 2, winner: "duo1", duo1Kos: 0, duo2Kos: 0 },
      ]);
      (db.query.matches.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
        { winner: "duo1", duo1Kos: 0, duo2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/sets/s-1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          matchNumber: 2,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.setResult).toBe("duo1");
    });
  });

  describe("POST /leagues/:id/finale", () => {
    it("generates finale round and returns 201", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.rounds.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "r-1",
          roundNumber: 1,
          status: "complete",
          sets: [
            {
              id: "s-1",
              duo1Trainer1: "t-1",
              duo1Trainer2: "t-2",
              duo2Trainer1: "t-3",
              duo2Trainer2: "t-4",
              result: "duo1",
              isBye: false,
              matches: [
                { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
                { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
              ],
            },
          ],
        },
      ]);
      (db.query.trainers.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "t-1", name: "A" },
        { id: "t-2", name: "B" },
        { id: "t-3", name: "C" },
        { id: "t-4", name: "D" },
      ]);
      mockReturning.mockResolvedValue([{ id: "r-finale", roundNumber: 2 }]);

      const res = await app.request("/leagues/league-1/finale", { method: "POST" });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.finaleRound).toBeDefined();
      expect(body.participants).toHaveLength(4);
    });

    it("rejects non-active league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });

      const res = await app.request("/leagues/league-1/finale", { method: "POST" });

      expect(res.status).toBe(400);
    });

    it("rejects if not all rounds are complete with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.rounds.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "r-1",
          roundNumber: 1,
          status: "pending",
          sets: [
            {
              id: "s-1",
              duo1Trainer1: "t-1",
              duo1Trainer2: "t-2",
              duo2Trainer1: "t-3",
              duo2Trainer2: "t-4",
              result: null,
              isBye: false,
              matches: [],
            },
          ],
        },
      ]);

      const res = await app.request("/leagues/league-1/finale", { method: "POST" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/finale", { method: "POST" });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /leagues/:id/sets/:sid/placements", () => {
    it("records FFA placements and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "finale",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        setType: "ffa",
      });
      (db.query.ffaParticipants.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "fp-1", setId: "s-1", trainerId: "t-1", placement: null },
        { id: "fp-2", setId: "s-1", trainerId: "t-2", placement: null },
        { id: "fp-3", setId: "s-1", trainerId: "t-3", placement: null },
        { id: "fp-4", setId: "s-1", trainerId: "t-4", placement: null },
      ]);
      mockReturning.mockResolvedValue([{}]);

      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            { trainerId: "t-1", placement: 1 },
            { trainerId: "t-2", placement: 2 },
            { trainerId: "t-3", placement: 3 },
            { trainerId: "t-4", placement: 4 },
          ],
        }),
      });

      expect(res.status).toBe(200);
    });

    it("rejects non-finale league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });

      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            { trainerId: "t-1", placement: 1 },
            { trainerId: "t-2", placement: 2 },
            { trainerId: "t-3", placement: 3 },
            { trainerId: "t-4", placement: 4 },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects non-ffa set with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "finale",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "s-1",
        setType: "2hg",
      });

      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            { trainerId: "t-1", placement: 1 },
            { trainerId: "t-2", placement: 2 },
            { trainerId: "t-3", placement: 3 },
            { trainerId: "t-4", placement: 4 },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects missing placements with 400", async () => {
      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            { trainerId: "t-1", placement: 1 },
          ],
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent set", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "finale",
      });
      (db.query.sets.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/sets/s-1/placements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            { trainerId: "t-1", placement: 1 },
          ],
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
