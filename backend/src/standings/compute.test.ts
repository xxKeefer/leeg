import { describe, expect, it } from "vitest";
import { deriveSetResult, computeStandings, type SetData, type MatchData, type FfaPlacement } from "./compute.js";

describe("deriveSetResult", () => {
  it("returns duo1 when duo1 wins 2 matches", () => {
    const matches: MatchData[] = [
      { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
      { winner: "duo1", duo1Kos: 2, duo2Kos: 2 },
    ];
    expect(deriveSetResult(matches)).toBe("duo1");
  });

  it("returns duo2 when duo2 wins 2 matches", () => {
    const matches: MatchData[] = [
      { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
      { winner: "duo2", duo1Kos: 1, duo2Kos: 3 },
      { winner: "duo2", duo1Kos: 0, duo2Kos: 3 },
    ];
    expect(deriveSetResult(matches)).toBe("duo2");
  });

  it("returns null when set is incomplete", () => {
    const matches: MatchData[] = [
      { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
    ];
    expect(deriveSetResult(matches)).toBeNull();
  });

  it("returns null for 1-1 with no match 3", () => {
    const matches: MatchData[] = [
      { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
      { winner: "duo2", duo1Kos: 1, duo2Kos: 3 },
    ];
    expect(deriveSetResult(matches)).toBeNull();
  });

  it("returns draw when all 3 matches are draws", () => {
    const matches: MatchData[] = [
      { winner: "draw", duo1Kos: 2, duo2Kos: 2 },
      { winner: "draw", duo1Kos: 1, duo2Kos: 1 },
      { winner: "draw", duo1Kos: 0, duo2Kos: 0 },
    ];
    expect(deriveSetResult(matches)).toBe("draw");
  });

  it("returns null for empty matches", () => {
    expect(deriveSetResult([])).toBeNull();
  });

  it("returns duo1 when 3 matches played with 2-1 score", () => {
    const matches: MatchData[] = [
      { winner: "duo2", duo1Kos: 1, duo2Kos: 3 },
      { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
      { winner: "duo1", duo1Kos: 2, duo2Kos: 2 },
    ];
    expect(deriveSetResult(matches)).toBe("duo1");
  });
});

describe("computeStandings", () => {
  it("returns empty array for no sets", () => {
    expect(computeStandings([])).toEqual([]);
  });

  it("awards 3 points to winners, 0 to losers", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
          { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(sets);
    expect(standings).toHaveLength(4);

    const t1 = standings.find((s) => s.trainerId === "t1")!;
    const t2 = standings.find((s) => s.trainerId === "t2")!;
    const t3 = standings.find((s) => s.trainerId === "t3")!;
    const t4 = standings.find((s) => s.trainerId === "t4")!;

    expect(t1.points).toBe(3);
    expect(t2.points).toBe(3);
    expect(t3.points).toBe(0);
    expect(t4.points).toBe(0);
  });

  it("both duo members get identical points and KO differential", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 4, duo2Kos: 2 },
          { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
        ],
      },
    ];
    const standings = computeStandings(sets);
    const t1 = standings.find((s) => s.trainerId === "t1")!;
    const t2 = standings.find((s) => s.trainerId === "t2")!;

    expect(t1.points).toBe(t2.points);
    expect(t1.koDifferential).toBe(t2.koDifferential);
    expect(t1.koDifferential).toBe(4); // (4-2) + (3-1)
  });

  it("awards 1 point for bye", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: null,
        duo2Trainer1: null,
        duo2Trainer2: null,
        result: "bye",
        isBye: true,
        matches: [],
      },
    ];
    const standings = computeStandings(sets);
    expect(standings).toHaveLength(1);
    expect(standings[0].points).toBe(1);
    expect(standings[0].koDifferential).toBe(0);
  });

  it("awards 1 point for duo bye (both trainers)", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: null,
        duo2Trainer2: null,
        result: "bye",
        isBye: true,
        matches: [],
      },
    ];
    const standings = computeStandings(sets);
    expect(standings).toHaveLength(2);
    expect(standings[0].points).toBe(1);
    expect(standings[1].points).toBe(1);
  });

  it("awards 1 point for draw", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "draw",
        isBye: false,
        matches: [
          { winner: "draw", duo1Kos: 2, duo2Kos: 2 },
          { winner: "draw", duo1Kos: 1, duo2Kos: 1 },
          { winner: "draw", duo1Kos: 0, duo2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(sets);
    for (const s of standings) {
      expect(s.points).toBe(1);
    }
  });

  it("ranks by points desc, then KO differential desc", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
          { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
        ],
      },
      {
        id: "s2",
        duo1Trainer1: "t5",
        duo1Trainer2: "t6",
        duo2Trainer1: "t7",
        duo2Trainer2: "t8",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 6, duo2Kos: 0 },
          { winner: "duo1", duo1Kos: 6, duo2Kos: 0 },
        ],
      },
    ];
    const standings = computeStandings(sets);

    expect(standings[0].trainerId).toBe("t5");
    expect(standings[0].rank).toBe(1);
    expect(standings[1].trainerId).toBe("t6");
    expect(standings[1].rank).toBe(2);
    expect(standings[2].trainerId).toBe("t1");
    expect(standings[2].rank).toBe(3);
  });

  it("flags top 4 as finalists", () => {
    const sets: SetData[] = [];
    for (let i = 1; i <= 6; i++) {
      sets.push({
        id: `s${i}`,
        duo1Trainer1: `t${i}`,
        duo1Trainer2: null,
        duo2Trainer1: null,
        duo2Trainer2: null,
        result: "bye",
        isBye: true,
        matches: [],
      });
    }
    sets.push({
      id: "swin",
      duo1Trainer1: "t1",
      duo1Trainer2: "t2",
      duo2Trainer1: "t5",
      duo2Trainer2: "t6",
      result: "duo1",
      isBye: false,
      matches: [
        { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
        { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
      ],
    });
    sets.push({
      id: "swin2",
      duo1Trainer1: "t3",
      duo1Trainer2: "t4",
      duo2Trainer1: "t5",
      duo2Trainer2: "t6",
      result: "duo1",
      isBye: false,
      matches: [
        { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
        { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
      ],
    });

    const standings = computeStandings(sets);
    const finalists = standings.filter((s) => s.isFinalist);
    const nonFinalists = standings.filter((s) => !s.isFinalist);

    expect(finalists).toHaveLength(4);
    expect(nonFinalists).toHaveLength(2);
  });

  it("accumulates KO differential across multiple sets", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 3, duo2Kos: 1 },
          { winner: "duo1", duo1Kos: 2, duo2Kos: 1 },
        ],
      },
      {
        id: "s2",
        duo1Trainer1: "t1",
        duo1Trainer2: "t5",
        duo2Trainer1: "t2",
        duo2Trainer2: "t3",
        result: "duo2",
        isBye: false,
        matches: [
          { winner: "duo2", duo1Kos: 0, duo2Kos: 3 },
          { winner: "duo2", duo1Kos: 1, duo2Kos: 2 },
        ],
      },
    ];
    const standings = computeStandings(sets);
    const t1 = standings.find((s) => s.trainerId === "t1")!;
    // s1: duo1 diff = (3-1)+(2-1) = 3, t1 gets +3
    // s2: duo1 diff = (0-3)+(1-2) = -4, t1 is duo1, gets -4
    expect(t1.koDifferential).toBe(3 - 4);
    expect(t1.points).toBe(3); // won s1, lost s2
  });

  it("skips sets with no result", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: null,
        isBye: false,
        matches: [],
      },
    ];
    const standings = computeStandings(sets);
    for (const s of standings) {
      expect(s.points).toBe(0);
      expect(s.koDifferential).toBe(0);
    }
  });

  it("adds FFA placement points to standings", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
          { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
        ],
      },
    ];
    const ffaPlacements: FfaPlacement[] = [
      { trainerId: "t1", placement: 1 },
      { trainerId: "t2", placement: 2 },
      { trainerId: "t3", placement: 3 },
      { trainerId: "t4", placement: 4 },
    ];

    const standings = computeStandings(sets, ffaPlacements);

    const t1 = standings.find((s) => s.trainerId === "t1")!;
    const t2 = standings.find((s) => s.trainerId === "t2")!;
    const t3 = standings.find((s) => s.trainerId === "t3")!;
    const t4 = standings.find((s) => s.trainerId === "t4")!;

    expect(t1.points).toBe(3 + 6);
    expect(t2.points).toBe(3 + 4);
    expect(t3.points).toBe(0 + 2);
    expect(t4.points).toBe(0 + 0);
  });

  it("handles empty FFA placements", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: "t2",
        duo2Trainer1: "t3",
        duo2Trainer2: "t4",
        result: "duo1",
        isBye: false,
        matches: [
          { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
          { winner: "duo1", duo1Kos: 3, duo2Kos: 0 },
        ],
      },
    ];

    const standings = computeStandings(sets, []);
    const t1 = standings.find((s) => s.trainerId === "t1")!;
    expect(t1.points).toBe(3);
  });

  it("handles FFA placements with null placement (not yet recorded)", () => {
    const sets: SetData[] = [
      {
        id: "s1",
        duo1Trainer1: "t1",
        duo1Trainer2: null,
        duo2Trainer1: null,
        duo2Trainer2: null,
        result: "bye",
        isBye: true,
        matches: [],
      },
    ];
    const ffaPlacements: FfaPlacement[] = [
      { trainerId: "t1", placement: null },
    ];

    const standings = computeStandings(sets, ffaPlacements);
    const t1 = standings.find((s) => s.trainerId === "t1")!;
    expect(t1.points).toBe(1);
  });
});
