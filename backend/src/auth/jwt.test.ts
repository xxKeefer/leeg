import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./jwt.js";

const TEST_SECRET = "test-secret-key-for-unit-tests";

describe("JWT utilities", () => {
  it("signs a token with a payload", async () => {
    const token = await signToken({ sub: "user-123" }, TEST_SECRET);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies a valid token and returns the payload", async () => {
    const token = await signToken({ sub: "user-123" }, TEST_SECRET);
    const payload = await verifyToken(token, TEST_SECRET);
    expect(payload.sub).toBe("user-123");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken({ sub: "user-123" }, TEST_SECRET);
    await expect(verifyToken(token, "wrong-secret")).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    await expect(verifyToken("not.a.jwt", TEST_SECRET)).rejects.toThrow();
  });
});
