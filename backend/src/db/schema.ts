import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  format: text("format").notNull().default("2hg"),
  status: text("status", { enum: ["draft", "active", "finale", "complete"] })
    .notNull()
    .default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leaguesRelations = relations(leagues, ({ many }) => ({
  players: many(players),
  rounds: many(rounds),
}));

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id),
  name: text("name").notNull(),
  showdownName: text("showdown_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playersRelations = relations(players, ({ one }) => ({
  league: one(leagues, { fields: [players.leagueId], references: [leagues.id] }),
}));

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id),
  roundNumber: integer("round_number").notNull(),
  roundType: text("round_type", { enum: ["regular", "finale"] })
    .notNull()
    .default("regular"),
  status: text("status", { enum: ["pending", "complete"] })
    .notNull()
    .default("pending"),
});

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  league: one(leagues, { fields: [rounds.leagueId], references: [leagues.id] }),
  matches: many(matches),
}));

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => rounds.id),
  matchType: text("match_type", { enum: ["2hg", "ffa"] })
    .notNull()
    .default("2hg"),
  team1Player1: uuid("team1_player1").references(() => players.id),
  team1Player2: uuid("team1_player2").references(() => players.id),
  team2Player1: uuid("team2_player1").references(() => players.id),
  team2Player2: uuid("team2_player2").references(() => players.id),
  result: text("result", { enum: ["team1", "team2", "draw", "bye"] }),
  isBye: boolean("is_bye").notNull().default(false),
  bestOf: integer("best_of").notNull().default(3),
});

export const matchesRelations = relations(matches, ({ one }) => ({
  round: one(rounds, { fields: [matches.roundId], references: [rounds.id] }),
}));
