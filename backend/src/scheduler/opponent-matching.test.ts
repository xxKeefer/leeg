import { describe, expect, it } from "vitest";
import { matchDuos, type DuoPairing } from "./opponent-matching.js";

describe("matchDuos", () => {
  it("pairs duos by closest standings", () => {
    const duos: [string, string][] = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
      ["G", "H"],
    ];
    const standings = new Map([
      ["A", 6],
      ["B", 6],
      ["C", 5],
      ["D", 5],
      ["E", 3],
      ["F", 3],
      ["G", 0],
      ["H", 0],
    ]);

    const result = matchDuos(duos, standings);
    expect(result.pairings).toHaveLength(2);
    expect(result.byeDuo).toBeNull();
  });

  it("assigns bye duo when odd number of duos", () => {
    const duos: [string, string][] = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ];
    const standings = new Map([
      ["A", 6],
      ["B", 6],
      ["C", 3],
      ["D", 3],
      ["E", 0],
      ["F", 0],
    ]);

    const result = matchDuos(duos, standings);
    expect(result.pairings).toHaveLength(1);
    expect(result.byeDuo).toBeDefined();
  });

  it("distributes byes using bye counts", () => {
    const standings = new Map<string, number>();
    const byeCounts = new Map<string, number>();

    const rounds: [string, string][][] = [
      [["A", "B"], ["C", "D"], ["E", "F"]],
      [["A", "C"], ["B", "E"], ["D", "F"]],
      [["A", "D"], ["B", "F"], ["C", "E"]],
    ];

    const byeDuos: [string, string][] = [];
    for (const duos of rounds) {
      const result = matchDuos(duos, standings, byeCounts);
      if (result.byeDuo) {
        byeDuos.push(result.byeDuo);
        for (const t of result.byeDuo) {
          byeCounts.set(t, (byeCounts.get(t) ?? 0) + 1);
        }
      }
    }

    const byeTrainers = byeDuos.flat();
    const counts = new Map<string, number>();
    for (const t of byeTrainers) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it("returns empty pairings for single duo", () => {
    const duos: [string, string][] = [["A", "B"]];
    const standings = new Map([
      ["A", 0],
      ["B", 0],
    ]);

    const result = matchDuos(duos, standings);
    expect(result.pairings).toHaveLength(0);
    expect(result.byeDuo).toEqual(["A", "B"]);
  });

  it("handles empty standings (all zeros)", () => {
    const duos: [string, string][] = [
      ["A", "B"],
      ["C", "D"],
    ];
    const standings = new Map<string, number>();

    const result = matchDuos(duos, standings);
    expect(result.pairings).toHaveLength(1);
    expect(result.byeDuo).toBeNull();
  });
});
