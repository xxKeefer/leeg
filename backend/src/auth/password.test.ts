import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes a password to a different string", async () => {
    const hash = await hashPassword("mysecret");
    expect(hash).not.toBe("mysecret");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("mysecret");
    expect(await verifyPassword(hash, "mysecret")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("mysecret");
    expect(await verifyPassword(hash, "wrongpassword")).toBe(false);
  });

  it("produces different hashes for the same input", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});
