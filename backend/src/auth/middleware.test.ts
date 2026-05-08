import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "./middleware.js";
import type { AuthVariables } from "../types.js";

vi.mock("./jwt.js", () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token === "valid-token") return { sub: "user-123" };
    throw new Error("invalid token");
  }),
}));

describe("auth middleware", () => {
  let app: Hono<{ Variables: AuthVariables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: AuthVariables }>();
    app.use("/protected/*", authMiddleware);
    app.get("/protected/data", (c) => {
      return c.json({ userId: c.get("userId") });
    });
  });

  it("allows requests with valid token", async () => {
    const res = await app.request("/protected/data", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-123");
  });

  it("rejects requests with no Authorization header", async () => {
    const res = await app.request("/protected/data");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await app.request("/protected/data", {
      headers: { Authorization: "Bearer bad-token" },
    });

    expect(res.status).toBe(401);
  });

  it("rejects malformed Authorization header", async () => {
    const res = await app.request("/protected/data", {
      headers: { Authorization: "NotBearer token" },
    });

    expect(res.status).toBe(401);
  });
});
