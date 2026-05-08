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
      players: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      rounds: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      matches: {
        findFirst: vi.fn(),
      },
      games: {
        findFirst: vi.fn(),
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
    it("returns league with players", async () => {
      const mockLeague = {
        id: "league-1",
        name: "Season 1",
        format: "2hg",
        status: "draft",
        players: [{ id: "p-1", name: "Ash", showdownName: "ash_ketchum" }],
      };
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLeague);

      const res = await app.request("/leagues/league-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.league.name).toBe("Season 1");
      expect(body.league.players).toHaveLength(1);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/players", () => {
    it("enrolls a player and returns 201", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.players.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const mockPlayer = {
        id: "p-1",
        name: "Ash",
        showdownName: "ash_ketchum",
        leagueId: "league-1",
      };
      mockReturning.mockResolvedValue([mockPlayer]);

      const res = await app.request("/leagues/league-1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.player.name).toBe("Ash");
      expect(body.player.showdownName).toBe("ash_ketchum");
    });

    it("rejects missing fields with 400", async () => {
      const res = await app.request("/leagues/league-1/players", {
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

      const res = await app.request("/leagues/league-1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects enrollment beyond 16 players with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      const sixteenPlayers = Array.from({ length: 16 }, (_, i) => ({
        id: `p-${i}`,
        name: `Player ${i}`,
      }));
      (db.query.players.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(sixteenPlayers);

      const res = await app.request("/leagues/league-1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Player 17", showdownName: "p17" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/16/);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ash", showdownName: "ash_ketchum" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /leagues/:id/players/:pid", () => {
    it("removes a player and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.players.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "p-1",
        name: "Ash",
        leagueId: "league-1",
      });

      const res = await app.request("/leagues/league-1/players/p-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });

    it("rejects removal from non-draft league with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });

      const res = await app.request("/leagues/league-1/players/p-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent player", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.players.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/players/p-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/players/p-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/generate", () => {
    it("generates schedule and returns 201", async () => {
      const players = [
        { id: "p-1", name: "A" },
        { id: "p-2", name: "B" },
        { id: "p-3", name: "C" },
        { id: "p-4", name: "D" },
      ];
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.players.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(players);
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

    it("rejects fewer than 4 players with 400", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "draft",
      });
      (db.query.players.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "p-1", name: "A" },
        { id: "p-2", name: "B" },
        { id: "p-3", name: "C" },
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
    it("returns schedule with rounds and matches", async () => {
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
          matches: [
            {
              id: "m-1",
              team1Player1: "p-1",
              team1Player2: "p-2",
              team2Player1: "p-3",
              team2Player2: "p-4",
              isBye: false,
            },
          ],
        },
      ]);

      const res = await app.request("/leagues/league-1/schedule");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rounds).toHaveLength(1);
      expect(body.rounds[0].matches).toHaveLength(1);
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
        matches: [
          {
            id: "m-1",
            team1Player1: "p-1",
            team1Player2: "p-2",
            team2Player1: "p-3",
            team2Player2: "p-4",
            isBye: false,
          },
        ],
      });

      const res = await app.request("/leagues/league-1/rounds/1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.round.roundNumber).toBe(1);
      expect(body.round.matches).toHaveLength(1);
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

  describe("PATCH /leagues/:id/games/:gid", () => {
    it("updates a game result and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "g-1",
        matchId: "m-1",
        gameNumber: 1,
      });
      const updatedGame = {
        id: "g-1",
        matchId: "m-1",
        gameNumber: 1,
        winner: "team1",
        team1Kos: 3,
        team2Kos: 1,
      };
      mockReturning.mockResolvedValue([updatedGame]);
      (db.query.games.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "team1", team1Kos: 3, team2Kos: 1 },
      ]);

      const res = await app.request("/leagues/league-1/games/g-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "team1", team1Kos: 3, team2Kos: 1 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.game.winner).toBe("team1");
    });

    it("auto-derives match result when team wins 2 games", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "g-2",
        matchId: "m-1",
        gameNumber: 2,
      });
      mockReturning.mockResolvedValue([
        { id: "g-2", matchId: "m-1", gameNumber: 2, winner: "team1", team1Kos: 3, team2Kos: 0 },
      ]);
      (db.query.games.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "team1", team1Kos: 3, team2Kos: 1 },
        { winner: "team1", team1Kos: 3, team2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/games/g-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "team1", team1Kos: 3, team2Kos: 0 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.matchResult).toBe("team1");
    });

    it("rejects missing fields with 400", async () => {
      const res = await app.request("/leagues/league-1/games/g-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "team1" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects invalid winner with 400", async () => {
      const res = await app.request("/leagues/league-1/games/g-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "invalid", team1Kos: 0, team2Kos: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/games/g-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "team1", team1Kos: 3, team2Kos: 1 }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent game", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/games/g-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: "team1", team1Kos: 3, team2Kos: 1 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /leagues/:id/matches/:mid", () => {
    it("overrides a match result and returns 200", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        roundId: "r-1",
      });
      const updated = { id: "m-1", result: "team2" };
      mockReturning.mockResolvedValue([updated]);

      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "team2" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.match.result).toBe("team2");
    });

    it("rejects invalid result with 400", async () => {
      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "invalid" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "team1" }),
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
        body: JSON.stringify({ result: "team1" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /leagues/:id/standings", () => {
    it("returns standings with player info", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.rounds.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "r-1",
          roundNumber: 1,
          matches: [
            {
              id: "m-1",
              team1Player1: "p-1",
              team1Player2: "p-2",
              team2Player1: "p-3",
              team2Player2: "p-4",
              result: "team1",
              isBye: false,
              games: [
                { winner: "team1", team1Kos: 3, team2Kos: 1 },
                { winner: "team1", team1Kos: 2, team2Kos: 0 },
              ],
            },
          ],
        },
      ]);
      (db.query.players.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "p-1", name: "Ash", showdownName: "ash_k" },
        { id: "p-2", name: "Brock", showdownName: "brock_r" },
        { id: "p-3", name: "Misty", showdownName: "misty_w" },
        { id: "p-4", name: "Gary", showdownName: "gary_o" },
      ]);

      const res = await app.request("/leagues/league-1/standings");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.standings).toHaveLength(4);
      expect(body.standings[0].points).toBe(3);
      expect(body.standings[0].playerName).toBe("Ash");
      expect(body.standings[2].points).toBe(0);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/standings");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /leagues/:id/matches/:mid/games", () => {
    it("submits replay URL and auto-populates game result", async () => {
      const protocol = "|player|p1|Alice|\n|player|p2|Bob|\n|faint|p2a: Pikachu\n|faint|p2a: Charizard\n|win|Alice";
      mockFetchReplay.mockResolvedValue(protocol);

      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        roundId: "r-1",
        team1Player1: "p-1",
        team1Player2: "p-2",
        team2Player1: "p-3",
        team2Player2: "p-4",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "g-1",
        matchId: "m-1",
        gameNumber: 1,
      });
      const updatedGame = {
        id: "g-1",
        matchId: "m-1",
        gameNumber: 1,
        replayUrl: "https://replay.pokemonshowdown.com/gen9doublesou-12345",
        protocol,
        winner: "team1",
        team1Kos: 2,
        team2Kos: 0,
      };
      mockReturning.mockResolvedValue([updatedGame]);
      (db.query.games.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "team1", team1Kos: 2, team2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/gen9doublesou-12345",
          gameNumber: 1,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.game.winner).toBe("team1");
      expect(body.game.team1Kos).toBe(2);
      expect(body.game.team2Kos).toBe(0);
      expect(body.game.replayUrl).toBe("https://replay.pokemonshowdown.com/gen9doublesou-12345");
    });

    it("returns 400 for missing replayUrl", async () => {
      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameNumber: 1 }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing gameNumber", async () => {
      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replayUrl: "https://replay.pokemonshowdown.com/test-123" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent league", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          gameNumber: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent match", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          gameNumber: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent game", async () => {
      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        roundId: "r-1",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          gameNumber: 1,
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
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        roundId: "r-1",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "g-1",
        matchId: "m-1",
        gameNumber: 1,
      });

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          gameNumber: 1,
        }),
      });

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/fetch/i);
    });

    it("auto-derives match result when enough games recorded", async () => {
      const protocol = "|player|p1|Alice|\n|player|p2|Bob|\n|win|Alice";
      mockFetchReplay.mockResolvedValue(protocol);

      (db.query.leagues.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "league-1",
        status: "active",
      });
      (db.query.matches.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "m-1",
        roundId: "r-1",
      });
      (db.query.games.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "g-2",
        matchId: "m-1",
        gameNumber: 2,
      });
      mockReturning.mockResolvedValue([
        { id: "g-2", matchId: "m-1", gameNumber: 2, winner: "team1", team1Kos: 0, team2Kos: 0 },
      ]);
      (db.query.games.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { winner: "team1", team1Kos: 3, team2Kos: 1 },
        { winner: "team1", team1Kos: 0, team2Kos: 0 },
      ]);

      const res = await app.request("/leagues/league-1/matches/m-1/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: "https://replay.pokemonshowdown.com/test-123",
          gameNumber: 2,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.matchResult).toBe("team1");
    });
  });
});
