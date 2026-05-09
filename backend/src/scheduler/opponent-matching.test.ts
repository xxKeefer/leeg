import { describe, expect, it } from "vitest";
import { matchTeams, type TeamPairing } from "./opponent-matching.js";

describe("matchTeams", () => {
  it("pairs teams by closest standings", () => {
    const teams: [string, string][] = [
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

    const result = matchTeams(teams, standings);
    expect(result.pairings).toHaveLength(2);
    expect(result.byeTeam).toBeNull();
  });

  it("assigns bye team when odd number of teams", () => {
    const teams: [string, string][] = [
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

    const result = matchTeams(teams, standings);
    expect(result.pairings).toHaveLength(1);
    expect(result.byeTeam).toBeDefined();
  });

  it("distributes byes using bye counts", () => {
    const standings = new Map<string, number>();
    const byeCounts = new Map<string, number>();

    const rounds: [string, string][][] = [
      [["A", "B"], ["C", "D"], ["E", "F"]],
      [["A", "C"], ["B", "E"], ["D", "F"]],
      [["A", "D"], ["B", "F"], ["C", "E"]],
    ];

    const byeTeams: [string, string][] = [];
    for (const teams of rounds) {
      const result = matchTeams(teams, standings, byeCounts);
      if (result.byeTeam) {
        byeTeams.push(result.byeTeam);
        for (const p of result.byeTeam) {
          byeCounts.set(p, (byeCounts.get(p) ?? 0) + 1);
        }
      }
    }

    const byePlayers = byeTeams.flat();
    const counts = new Map<string, number>();
    for (const p of byePlayers) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }

    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it("returns empty pairings for single team", () => {
    const teams: [string, string][] = [["A", "B"]];
    const standings = new Map([
      ["A", 0],
      ["B", 0],
    ]);

    const result = matchTeams(teams, standings);
    expect(result.pairings).toHaveLength(0);
    expect(result.byeTeam).toEqual(["A", "B"]);
  });

  it("handles empty standings (all zeros)", () => {
    const teams: [string, string][] = [
      ["A", "B"],
      ["C", "D"],
    ];
    const standings = new Map<string, number>();

    const result = matchTeams(teams, standings);
    expect(result.pairings).toHaveLength(1);
    expect(result.byeTeam).toBeNull();
  });
});
