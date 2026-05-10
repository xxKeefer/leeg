import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { users, leagues, trainers, rounds, sets, ffaParticipants } from "./schema.js";

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

describe("trainers schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(trainers);
    expect(Object.keys(columns).sort()).toEqual(["createdAt", "id", "leagueId", "name", "showdownName"]);
  });

  it("name is not null", () => {
    const columns = getTableColumns(trainers);
    expect(columns.name.notNull).toBe(true);
  });

  it("showdownName is not null", () => {
    const columns = getTableColumns(trainers);
    expect(columns.showdownName.notNull).toBe(true);
  });

  it("leagueId is not null", () => {
    const columns = getTableColumns(trainers);
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

describe("sets schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(sets);
    expect(Object.keys(columns).sort()).toEqual([
      "bestOf",
      "duo1Trainer1",
      "duo1Trainer2",
      "duo2Trainer1",
      "duo2Trainer2",
      "id",
      "isBye",
      "result",
      "roundId",
      "setType",
    ]);
  });

  it("roundId is not null", () => {
    const columns = getTableColumns(sets);
    expect(columns.roundId.notNull).toBe(true);
  });

  it("isBye defaults to false", () => {
    const columns = getTableColumns(sets);
    expect(columns.isBye.notNull).toBe(true);
  });

  it("duo trainer columns are nullable", () => {
    const columns = getTableColumns(sets);
    expect(columns.duo1Trainer1.notNull).toBe(false);
    expect(columns.duo2Trainer1.notNull).toBe(false);
  });
});

describe("ffaParticipants schema", () => {
  it("has the expected columns", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(Object.keys(columns).sort()).toEqual([
      "id",
      "placement",
      "setId",
      "trainerId",
    ]);
  });

  it("placement is nullable", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(columns.placement.notNull).toBe(false);
  });

  it("setId and trainerId are required", () => {
    const columns = getTableColumns(ffaParticipants);
    expect(columns.setId.notNull).toBe(true);
    expect(columns.trainerId.notNull).toBe(true);
  });
});
