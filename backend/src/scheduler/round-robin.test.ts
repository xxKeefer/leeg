import { describe, expect, it } from "vitest";
import { generatePartnershipSchedule, type ScheduleRound } from "./round-robin.js";

describe("generatePartnershipSchedule", () => {
  it("generates N-1 rounds for even trainer count", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3);
  });

  it("generates N rounds for odd trainer count", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    expect(rounds).toHaveLength(5);
  });

  it("every trainer partners with every other trainer exactly once (4 trainers)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    const partnerships = new Set<string>();

    for (const round of rounds) {
      for (const duo of round.duos) {
        const pair = [duo[0], duo[1]].sort().join(",");
        expect(partnerships.has(pair)).toBe(false);
        partnerships.add(pair);
      }
    }

    expect(partnerships.size).toBe(6);
  });

  it("every trainer partners with every other trainer exactly once (6 trainers)", () => {
    const trainers = ["A", "B", "C", "D", "E", "F"];
    const rounds = generatePartnershipSchedule(trainers);
    const partnerships = new Set<string>();

    for (const round of rounds) {
      for (const duo of round.duos) {
        const pair = [duo[0], duo[1]].sort().join(",");
        expect(partnerships.has(pair)).toBe(false);
        partnerships.add(pair);
      }
    }

    expect(partnerships.size).toBe(15);
  });

  it("odd trainer count: exactly one bye trainer per round", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    for (const round of rounds) {
      expect(round.byeTrainer).toBeDefined();
    }
  });

  it("odd trainer count: bye rotates across trainers", () => {
    const trainers = ["A", "B", "C", "D", "E"];
    const rounds = generatePartnershipSchedule(trainers);
    const byeTrainers = rounds.map((r) => r.byeTrainer);
    const uniqueByes = new Set(byeTrainers);
    expect(uniqueByes.size).toBe(5);
  });

  it("even trainer count: no bye trainers", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    for (const round of rounds) {
      expect(round.byeTrainer).toBeNull();
    }
  });

  it("each round has correct number of duos (even)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    for (const round of rounds) {
      expect(round.duos).toHaveLength(2);
    }
  });

  it("each round has correct number of duos (odd)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D", "E"]);
    for (const round of rounds) {
      expect(round.duos).toHaveLength(2);
    }
  });

  it("works with 16 trainers (maximum)", () => {
    const trainers = Array.from({ length: 16 }, (_, i) => `T${i}`);
    const rounds = generatePartnershipSchedule(trainers);
    expect(rounds).toHaveLength(15);

    const partnerships = new Set<string>();
    for (const round of rounds) {
      for (const duo of round.duos) {
        const pair = [duo[0], duo[1]].sort().join(",");
        partnerships.add(pair);
      }
    }
    expect(partnerships.size).toBe(120);
  });

  it("works with 4 trainers (minimum)", () => {
    const rounds = generatePartnershipSchedule(["A", "B", "C", "D"]);
    expect(rounds).toHaveLength(3);

    const partnerships = new Set<string>();
    for (const round of rounds) {
      for (const duo of round.duos) {
        const pair = [duo[0], duo[1]].sort().join(",");
        partnerships.add(pair);
      }
    }
    expect(partnerships.size).toBe(6);
  });

  it("no trainer appears more than once per round", () => {
    const trainers = Array.from({ length: 8 }, (_, i) => `T${i}`);
    const rounds = generatePartnershipSchedule(trainers);

    for (const round of rounds) {
      const seen = new Set<string>();
      for (const duo of round.duos) {
        for (const t of duo) {
          expect(seen.has(t)).toBe(false);
          seen.add(t);
        }
      }
      if (round.byeTrainer) {
        expect(seen.has(round.byeTrainer)).toBe(false);
      }
    }
  });
});
