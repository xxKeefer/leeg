import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { users, leagues, players, rounds, matches, ffaParticipants } from "./schema.js";

describe("users schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(users);
    expect(Object.keys(columns).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "passwordHash",
      "updatedAt",
    ]);
  });

  it("id is uuid primary key", () => {
    const columns = getTableColumns(users);
    expect(columns.id.dataType).toBe("string");
    expect(columns.id.notNull).toBe(true);
  });

  it("email is unique and not null", () => {
    const columns = getTableColumns(users);
    expect(columns.email.notNull).toBe(true);
    expect(columns.email.isUnique).toBe(true);
  });

  it("passwordHash is not null", () => {
    const columns = getTableColumns(users);
    expect(columns.passwordHash.notNull).toBe(true);
  });
});

describe("leagues schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(leagues);
    expect(Object.keys(columns).sort()).toEqual([
      "createdAt",
      "createdBy",
      "format",
      "id",
      "name",
      "status",
      "updatedAt",
    ]);
  });

  it("name is not null", () => {
    const columns = getTableColumns(leagues);
    expect(columns.name.notNull).toBe(true);
  });

  it("format is not null", () => {
    const columns = getTableColumns(leagues);
    expect(columns.format.notNull).toBe(true);
  });

  it("status is not null", () => {
    const columns = getTableColumns(leagues);
    expect(columns.status.notNull).toBe(true);
  });

  it("createdBy is not null", () => {
    const columns = getTableColumns(leagues);
    expect(columns.createdBy.notNull).toBe(true);
  });
});

describe("players schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(players);
    expect(Object.keys(columns).sort()).toEqual(["createdAt", "id", "leagueId", "name", "showdownName"]);
  });

  it("name is not null", () => {
    const columns = getTableColumns(players);
    expect(columns.name.notNull).toBe(true);
  });

  it("showdownName is not null", () => {
    const columns = getTableColumns(players);
    expect(columns.showdownName.notNull).toBe(true);
  });

  it("leagueId is not null", () => {
    const columns = getTableColumns(players);
    expect(columns.leagueId.notNull).toBe(true);
  });
});

describe("rounds schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(rounds);
    expect(Object.keys(columns).sort()).toEqual(["id", "leagueId", "roundNumber", "roundType", "status"]);
  });

  it("leagueId is not null", () => {
    const columns = getTableColumns(rounds);
    expect(columns.leagueId.notNull).toBe(true);
  });

  it("roundNumber is not null", () => {
    const columns = getTableColumns(rounds);
    expect(columns.roundNumber.notNull).toBe(true);
  });
});

describe("matches schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(matches);
    expect(Object.keys(columns).sort()).toEqual([
      "bestOf",
      "id",
      "isBye",
      "matchType",
      "result",
      "roundId",
      "team1Player1",
      "team1Player2",
      "team2Player1",
      "team2Player2",
    ]);
  });

  it("roundId is not null", () => {
    const columns = getTableColumns(matches);
    expect(columns.roundId.notNull).toBe(true);
  });

  it("isBye defaults to false", () => {
    const columns = getTableColumns(matches);
    expect(columns.isBye.notNull).toBe(true);
  });

  it("team player columns are nullable", () => {
    const columns = getTableColumns(matches);
    expect(columns.team1Player1.notNull).toBe(false);
    expect(columns.team2Player1.notNull).toBe(false);
  });
});

describe("ffaParticipants schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(Object.keys(columns).sort()).toEqual([
      "id",
      "matchId",
      "placement",
      "playerId",
    ]);
  });

  it("placement is nullable", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(columns.placement.notNull).toBe(false);
  });

  it("matchId and playerId are required", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(columns.matchId.notNull).toBe(true);
    expect(columns.playerId.notNull).toBe(true);
  });
});
