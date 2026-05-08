import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { leagueRoutes } from "./routes.js";
import type { AuthVariables } from "../types.js";

const { mockReturning, mockSet } = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockSet: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
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
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
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
});
