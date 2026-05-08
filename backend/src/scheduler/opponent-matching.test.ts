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
