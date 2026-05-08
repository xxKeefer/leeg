import { describe, expect, it } from "vitest";
import { generatePartnershipSchedule, type ScheduleRound } from "./round-robin.js";

describe("generatePartnershipSchedule", () => {
  it("generates N-1 rounds for even player count", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3);
  });

  it("generates N rounds for odd player count", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    expect(rounds).toHaveLength(5);
  });

  it("every player partners with every other player exactly once (4 players)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    const partnerships = new Set<string>();

    for (const round of rounds) {
      for (const team of round.teams) {
        const pair = [team[0], team[1]].sort().join(",");
        expect(partnerships.has(pair)).toBe(false);
        partnerships.add(pair);
      }
    }

    expect(partnerships.size).toBe(6);
  });

  it("every player partners with every other player exactly once (6 players)", () => {
    const players = ["A", "B", "C", "D", "E", "F"];
    const rounds = generatePartnershipSchedule(players);
    const partnerships = new Set<string>();

    for (const round of rounds) {
      for (const team of round.teams) {
        const pair = [team[0], team[1]].sort().join(",");
        expect(partnerships.has(pair)).toBe(false);
        partnerships.add(pair);
      }
    }

    expect(partnerships.size).toBe(15);
  });

  it("odd player count: exactly one bye player per round", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    for (const round of rounds) {
      expect(round.byePlayer).toBeDefined();
    }
  });

  it("odd player count: bye rotates across players", () => {
    const players = ["A", "B", "C", "D", "E"];
    const rounds = generatePartnershipSchedule(players);
    const byePlayers = rounds.map((r) => r.byePlayer);
    const uniqueByes = new Set(byePlayers);
    expect(uniqueByes.size).toBe(5);
  });

  it("even player count: no bye players", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    for (const round of rounds) {
      expect(round.byePlayer).toBeNull();
    }
  });

  it("each round has correct number of teams (even)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    for (const round of rounds) {
      expect(round.teams).toHaveLength(2);
    }
  });

  it("each round has correct number of teams (odd)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    for (const round of rounds) {
      expect(round.teams).toHaveLength(2);
    }
  });

  it("works with 16 players (maximum)", () => {
    const players = Array.from({ length: 16 }, (_, i) => `P${i}`);
    const rounds = generatePartnershipSchedule(players);
    expect(rounds).toHaveLength(15);

    const partnerships = new Set<string>();
    for (const round of rounds) {
      for (const team of round.teams) {
        const pair = [team[0], team[1]].sort().join(",");
        partnerships.add(pair);
      }
    }
    expect(partnerships.size).toBe(120);
  });

  it("works with 4 players (minimum)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3);

    const partnerships = new Set<string>();
    for (const round of rounds) {
      for (const team of round.teams) {
        const pair = [team[0], team[1]].sort().join(",");
        partnerships.add(pair);
      }
    }
    expect(partnerships.size).toBe(6);
  });

  it("no player appears more than once per round", () => {
    const players = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const rounds = generatePartnershipSchedule(players);

    for (const round of rounds) {
      const seen = new Set<string>();
      for (const team of round.teams) {
        for (const p of team) {
          expect(seen.has(p)).toBe(false);
          seen.add(p);
        }
      }
      if (round.byePlayer) {
        expect(seen.has(round.byePlayer)).toBe(false);
      }
    }
  });
});
