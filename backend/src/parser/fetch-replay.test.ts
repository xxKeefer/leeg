import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchReplayProtocol, extractReplayId } from "./fetch-replay.js";

describe("extractReplayId", () => {
  it("extracts id from full URL", () => {
    expect(extractReplayId("https://replay.pokemonshowdown.com/gen9doublesou-12345")).toBe(
      "gen9doublesou-12345",
    );
  });

  it("extracts id from URL without protocol", () => {
    expect(extractReplayId("replay.pokemonshowdown.com/gen9doublesou-12345")).toBe(
      "gen9doublesou-12345",
    );
  });

  it("extracts id from URL with http", () => {
    expect(extractReplayId("http://replay.pokemonshowdown.com/gen9doublesou-12345")).toBe(
      "gen9doublesou-12345",
    );
  });

  it("extracts id from URL with trailing slash", () => {
    expect(extractReplayId("https://replay.pokemonshowdown.com/gen9doublesou-12345/")).toBe(
      "gen9doublesou-12345",
    );
  });

  it("returns null for invalid URL", () => {
    expect(extractReplayId("https://example.com/replay")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractReplayId("")).toBeNull();
  });
});

describe("fetchReplayProtocol", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches protocol from valid replay URL", async () => {
    const mockLog = "|player|p1|Alice|\n|win|Alice";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ log: mockLog }), { status: 200 }),
    );

    const result = await fetchReplayProtocol("https://replay.pokemonshowdown.com/gen9doublesou-12345");
    expect(result).toBe(mockLog);
    expect(fetch).toHaveBeenCalledWith("https://replay.pokemonshowdown.com/gen9doublesou-12345.json");
  });

  it("throws on invalid URL format", async () => {
    await expect(fetchReplayProtocol("https://example.com/not-a-replay")).rejects.toThrow(
      "Invalid replay URL",
    );
  });

  it("throws on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    await expect(
      fetchReplayProtocol("https://replay.pokemonshowdown.com/gen9doublesou-12345"),
    ).rejects.toThrow("Failed to fetch replay");
  });

  it("throws on missing log field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await expect(
      fetchReplayProtocol("https://replay.pokemonshowdown.com/gen9doublesou-12345"),
    ).rejects.toThrow("No protocol log found");
  });

  it("throws on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    await expect(
      fetchReplayProtocol("https://replay.pokemonshowdown.com/gen9doublesou-12345"),
    ).rejects.toThrow("Network error");
  });
});
