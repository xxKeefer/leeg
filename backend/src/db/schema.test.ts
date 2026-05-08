import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { users, leagues, players } from "./schema.js";

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
