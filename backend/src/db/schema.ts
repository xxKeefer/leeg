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
  trainers: many(trainers),
  rounds: many(rounds),
}));

export const trainers = pgTable("trainers", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id),
  name: text("name").notNull(),
  showdownName: text("showdown_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainersRelations = relations(trainers, ({ one }) => ({
  league: one(leagues, { fields: [trainers.leagueId], references: [leagues.id] }),
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
  sets: many(sets),
}));

export const sets = pgTable("sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id")
    .notNull()
    .references(() => rounds.id),
  setType: text("set_type", { enum: ["2hg", "ffa"] })
    .notNull()
    .default("2hg"),
  duo1Trainer1: uuid("duo1_trainer1").references(() => trainers.id),
  duo1Trainer2: uuid("duo1_trainer2").references(() => trainers.id),
  duo2Trainer1: uuid("duo2_trainer1").references(() => trainers.id),
  duo2Trainer2: uuid("duo2_trainer2").references(() => trainers.id),
  result: text("result", { enum: ["duo1", "duo2", "draw", "bye"] }),
  isBye: boolean("is_bye").notNull().default(false),
  bestOf: integer("best_of").notNull().default(3),
});

export const setsRelations = relations(sets, ({ one, many }) => ({
  round: one(rounds, { fields: [sets.roundId], references: [rounds.id] }),
  matches: many(matches),
  ffaParticipants: many(ffaParticipants),
}));

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  setId: uuid("set_id")
    .notNull()
    .references(() => sets.id),
  matchNumber: integer("match_number").notNull(),
  replayUrl: text("replay_url"),
  protocol: text("protocol"),
  winner: text("winner", { enum: ["duo1", "duo2", "draw"] }),
  duo1Kos: integer("duo1_kos").notNull().default(0),
  duo2Kos: integer("duo2_kos").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchesRelations = relations(matches, ({ one }) => ({
  set: one(sets, { fields: [matches.setId], references: [sets.id] }),
}));

export const ffaParticipants = pgTable("ffa_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  setId: uuid("set_id")
    .notNull()
    .references(() => sets.id),
  trainerId: uuid("trainer_id")
    .notNull()
    .references(() => trainers.id),
  placement: integer("placement"),
});

export const ffaParticipantsRelations = relations(ffaParticipants, ({ one }) => ({
  set: one(sets, { fields: [ffaParticipants.setId], references: [sets.id] }),
  trainer: one(trainers, { fields: [ffaParticipants.trainerId], references: [trainers.id] }),
}));
