import { describe, expect, it } from "vitest";
import { deriveMatchResult, computeStandings, type MatchData, type GameData, type FfaPlacement } from "./compute.js";

describe("deriveMatchResult", () => {
  it("returns team1 when team1 wins 2 games", () => {
    const games: GameData[] = [
      { winner: "team1", team1Kos: 3, team2Kos: 1 },
      { winner: "team1", team1Kos: 2, team2Kos: 2 },
    ];
    expect(deriveMatchResult(games)).toBe("team1");
  });

  it("returns team2 when team2 wins 2 games", () => {
    const games: GameData[] = [
      { winner: "team1", team1Kos: 3, team2Kos: 1 },
      { winner: "team2", team1Kos: 1, team2Kos: 3 },
      { winner: "team2", team1Kos: 0, team2Kos: 3 },
    ];
    expect(deriveMatchResult(games)).toBe("team2");
  });

  it("returns null when match is incomplete", () => {
    const games: GameData[] = [
      { winner: "team1", team1Kos: 3, team2Kos: 1 },
    ];
    expect(deriveMatchResult(games)).toBeNull();
  });

  it("returns null for 1-1 with no game 3", () => {
    const games: GameData[] = [
      { winner: "team1", team1Kos: 3, team2Kos: 1 },
      { winner: "team2", team1Kos: 1, team2Kos: 3 },
    ];
    expect(deriveMatchResult(games)).toBeNull();
  });

  it("returns draw when all 3 games are draws", () => {
    const games: GameData[] = [
      { winner: "draw", team1Kos: 2, team2Kos: 2 },
      { winner: "draw", team1Kos: 1, team2Kos: 1 },
      { winner: "draw", team1Kos: 0, team2Kos: 0 },
    ];
    expect(deriveMatchResult(games)).toBe("draw");
  });

  it("returns null for empty games", () => {
    expect(deriveMatchResult([])).toBeNull();
  });

  it("returns team1 when 3 games played with 2-1 score", () => {
    const games: GameData[] = [
      { winner: "team2", team1Kos: 1, team2Kos: 3 },
      { winner: "team1", team1Kos: 3, team2Kos: 1 },
      { winner: "team1", team1Kos: 2, team2Kos: 2 },
    ];
    expect(deriveMatchResult(games)).toBe("team1");
  });
});

describe("computeStandings", () => {
  it("returns empty array for no matches", () => {
    expect(computeStandings([])).toEqual([]);
  });

  it("awards 3 points to winners, 0 to losers", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 3, team2Kos: 1 },
          { winner: "team1", team1Kos: 3, team2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(matches);
    expect(standings).toHaveLength(4);

    const p1 = standings.find((s) => s.playerId === "p1")!;
    const p2 = standings.find((s) => s.playerId === "p2")!;
    const p3 = standings.find((s) => s.playerId === "p3")!;
    const p4 = standings.find((s) => s.playerId === "p4")!;

    expect(p1.points).toBe(3);
    expect(p2.points).toBe(3);
    expect(p3.points).toBe(0);
    expect(p4.points).toBe(0);
  });

  it("both team members get identical points and KO differential", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 4, team2Kos: 2 },
          { winner: "team1", team1Kos: 3, team2Kos: 1 },
        ],
      },
    ];
    const standings = computeStandings(matches);
    const p1 = standings.find((s) => s.playerId === "p1")!;
    const p2 = standings.find((s) => s.playerId === "p2")!;

    expect(p1.points).toBe(p2.points);
    expect(p1.koDifferential).toBe(p2.koDifferential);
    expect(p1.koDifferential).toBe(4); // (4-2) + (3-1)
  });

  it("awards 1 point for bye", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: null,
        team2Player1: null,
        team2Player2: null,
        result: "bye",
        isBye: true,
        games: [],
      },
    ];
    const standings = computeStandings(matches);
    expect(standings).toHaveLength(1);
    expect(standings[0].points).toBe(1);
    expect(standings[0].koDifferential).toBe(0);
  });

  it("awards 1 point for team bye (both players)", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: null,
        team2Player2: null,
        result: "bye",
        isBye: true,
        games: [],
      },
    ];
    const standings = computeStandings(matches);
    expect(standings).toHaveLength(2);
    expect(standings[0].points).toBe(1);
    expect(standings[1].points).toBe(1);
  });

  it("awards 1 point for draw", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "draw",
        isBye: false,
        games: [
          { winner: "draw", team1Kos: 2, team2Kos: 2 },
          { winner: "draw", team1Kos: 1, team2Kos: 1 },
          { winner: "draw", team1Kos: 0, team2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(matches);
    for (const s of standings) {
      expect(s.points).toBe(1);
    }
  });

  it("ranks by points desc, then KO differential desc", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 3, team2Kos: 1 },
          { winner: "team1", team1Kos: 3, team2Kos: 1 },
        ],
      },
      {
        id: "m2",
        team1Player1: "p5",
        team1Player2: "p6",
        team2Player1: "p7",
        team2Player2: "p8",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 6, team2Kos: 0 },
          { winner: "team1", team1Kos: 6, team2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(matches);

    expect(standings[0].playerId).toBe("p5");
    expect(standings[0].rank).toBe(1);
    expect(standings[1].playerId).toBe("p6");
    expect(standings[1].rank).toBe(2);
    expect(standings[2].playerId).toBe("p1");
    expect(standings[2].rank).toBe(3);
  });

  it("flags top 4 as finalists", () => {
    const matches: MatchData[] = [];
    for (let i = 1; i <= 6; i++) {
      matches.push({
        id: `m${i}`,
        team1Player1: `p${i}`,
        team1Player2: null,
        team2Player1: null,
        team2Player2: null,
        result: "bye",
        isBye: true,
        games: [],
      });
    }
    // Give first 4 players extra points via a win
    matches.push({
      id: "mwin",
      team1Player1: "p1",
      team1Player2: "p2",
      team2Player1: "p5",
      team2Player2: "p6",
      result: "team1",
      isBye: false,
      games: [
        { winner: "team1", team1Kos: 3, team2Kos: 0 },
        { winner: "team1", team1Kos: 3, team2Kos: 0 },
      ],
    });
    matches.push({
      id: "mwin2",
      team1Player1: "p3",
      team1Player2: "p4",
      team2Player1: "p5",
      team2Player2: "p6",
      result: "team1",
      isBye: false,
      games: [
        { winner: "team1", team1Kos: 3, team2Kos: 0 },
        { winner: "team1", team1Kos: 3, team2Kos: 0 },
      ],
    });

    const standings = computeStandings(matches);
    const finalists = standings.filter((s) => s.isFinalist);
    const nonFinalists = standings.filter((s) => !s.isFinalist);

    expect(finalists).toHaveLength(4);
    expect(nonFinalists).toHaveLength(2);
  });

  it("accumulates KO differential across multiple matches", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 3, team2Kos: 1 },
          { winner: "team1", team1Kos: 2, team2Kos: 1 },
        ],
      },
      {
        id: "m2",
        team1Player1: "p1",
        team1Player2: "p5",
        team2Player1: "p2",
        team2Player2: "p3",
        result: "team2",
        isBye: false,
        games: [
          { winner: "team2", team1Kos: 0, team2Kos: 3 },
          { winner: "team2", team1Kos: 1, team2Kos: 2 },
        ],
      },
    ];
    const standings = computeStandings(matches);
    const p1 = standings.find((s) => s.playerId === "p1")!;
    // m1: team1 diff = (3-1)+(2-1) = 3, p1 gets +3
    // m2: team1 diff = (0-3)+(1-2) = -4, p1 is team1, gets -4
    expect(p1.koDifferential).toBe(3 - 4);
    expect(p1.points).toBe(3); // won m1, lost m2
  });

  it("skips matches with no result", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: null,
        isBye: false,
        games: [],
      },
    ];
    const standings = computeStandings(matches);
    for (const s of standings) {
      expect(s.points).toBe(0);
      expect(s.koDifferential).toBe(0);
    }
  });

  it("adds FFA placement points to standings", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 3, team2Kos: 0 },
          { winner: "team1", team1Kos: 3, team2Kos: 0 },
        ],
      },
    ];
    const ffaPlacements: FfaPlacement[] = [
      { playerId: "p1", placement: 1 },
      { playerId: "p2", placement: 2 },
      { playerId: "p3", placement: 3 },
      { playerId: "p4", placement: 4 },
    ];

    const standings = computeStandings(matches, ffaPlacements);

    const p1 = standings.find((s) => s.playerId === "p1")!;
    const p2 = standings.find((s) => s.playerId === "p2")!;
    const p3 = standings.find((s) => s.playerId === "p3")!;
    const p4 = standings.find((s) => s.playerId === "p4")!;

    expect(p1.points).toBe(3 + 6);
    expect(p2.points).toBe(3 + 4);
    expect(p3.points).toBe(0 + 2);
    expect(p4.points).toBe(0 + 0);
  });

  it("handles empty FFA placements", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: "p2",
        team2Player1: "p3",
        team2Player2: "p4",
        result: "team1",
        isBye: false,
        games: [
          { winner: "team1", team1Kos: 3, team2Kos: 0 },
          { winner: "team1", team1Kos: 3, team2Kos: 0 },
        ],
      },
    ];

    const standings = computeStandings(matches, []);
    const p1 = standings.find((s) => s.playerId === "p1")!;
    expect(p1.points).toBe(3);
  });

  it("handles FFA placements with null placement (not yet recorded)", () => {
    const matches: MatchData[] = [
      {
        id: "m1",
        team1Player1: "p1",
        team1Player2: null,
        team2Player1: null,
        team2Player2: null,
        result: "bye",
        isBye: true,
        games: [],
      },
    ];
    const ffaPlacements: FfaPlacement[] = [
      { playerId: "p1", placement: null },
    ];

    const standings = computeStandings(matches, ffaPlacements);
    const p1 = standings.find((s) => s.playerId === "p1")!;
    expect(p1.points).toBe(1);
  });
});
