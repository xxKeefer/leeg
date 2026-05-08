import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authRoutes } from "./routes.js";

vi.mock("../db/index.js", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("./password.js", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed_${p}`),
  verifyPassword: vi.fn(async (h: string, p: string) => h === `hashed_${p}`),
}));

vi.mock("./jwt.js", () => ({
  signToken: vi.fn(async () => "mock.jwt.token"),
}));

import { db } from "../db/index.js";

describe("auth routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route("/auth", authRoutes);
  });

  describe("POST /auth/register", () => {
    it("creates a user and returns 201", async () => {
      const mockUser = { id: "uuid-1", email: "a@b.com" };
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db as unknown as { returning: ReturnType<typeof vi.fn> }).returning.mockResolvedValue([
        mockUser,
      ]);

      const res = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "secret123" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.user.email).toBe("a@b.com");
    });

    it("rejects duplicate email with 409", async () => {
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing",
        email: "a@b.com",
      });

      const res = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "secret123" }),
      });

      expect(res.status).toBe(409);
    });

    it("rejects missing fields with 400", async () => {
      const res = await app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("returns a JWT for valid credentials", async () => {
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uuid-1",
        email: "a@b.com",
        passwordHash: "hashed_secret123",
      });

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "secret123" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBe("mock.jwt.token");
    });

    it("rejects invalid credentials with 401", async () => {
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "uuid-1",
        email: "a@b.com",
        passwordHash: "hashed_other",
      });

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "wrong" }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects non-existent user with 401", async () => {
      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nope@b.com", password: "secret123" }),
      });

      expect(res.status).toBe(401);
    });
  });
});
