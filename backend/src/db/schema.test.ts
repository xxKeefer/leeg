import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { users } from "./schema.js";

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
