import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { leagueRoutes } from "./routes.js";
import type { AuthVariables } from "../types.js";

vi.mock("../db/index.js", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    query: {
      leagues: {
        findFirst: vi.fn(),
      },
      players: {
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
  });

  describe("POST /leagues", () => {
    it("creates a league and returns 201", async () => {
      const mockLeague = { id: "league-1", name: "Season 1", format: "2hg", status: "draft" };
      (db as unknown as { returning: ReturnType<typeof vi.fn> }).returning.mockResolvedValue([
        mockLeague,
      ]);

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
      (db as unknown as { returning: ReturnType<typeof vi.fn> }).returning.mockResolvedValue([
        mockPlayer,
      ]);

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
      (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
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
});
