import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// --- Tables ---

export const trainers = sqliteTable('trainers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  budget: integer('budget').notNull().default(100),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const pokemon = sqliteTable('pokemon', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id),
  species: text('species').notNull(),
  cost: integer('cost').notNull().default(0),
})

export const weeks = sqliteTable('weeks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  weekNumber: integer('week_number').notNull(),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
})

export const teamPairings = sqliteTable('team_pairings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  weekId: integer('week_id').notNull().references(() => weeks.id),
  trainerAId: integer('trainer_a_id').notNull().references(() => trainers.id),
  trainerBId: integer('trainer_b_id').notNull().references(() => trainers.id),
})

export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  weekId: integer('week_id').notNull().references(() => weeks.id),
  pairingAId: integer('pairing_a_id').notNull().references(() => teamPairings.id),
  pairingBId: integer('pairing_b_id').notNull().references(() => teamPairings.id),
})

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull().references(() => matches.id),
  gameNumber: integer('game_number').notNull(),
  winnerId: integer('winner_id').references(() => trainers.id),
  replayUrl: text('replay_url'),
})

export const battleLogs = sqliteTable('battle_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id).unique(),
  rawLog: text('raw_log').notNull(),
  parsedAt: text('parsed_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const pokemonGameStats = sqliteTable('pokemon_game_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  pokemonId: integer('pokemon_id').notNull().references(() => pokemon.id),
  trainerId: integer('trainer_id').notNull().references(() => trainers.id),
  damageDealt: real('damage_dealt').notNull().default(0),
  damageTaken: real('damage_taken').notNull().default(0),
  kos: integer('kos').notNull().default(0),
  faints: integer('faints').notNull().default(0),
  turnsSurvived: integer('turns_survived').notNull().default(0),
})

export const turnEvents = sqliteTable('turn_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  turnNumber: integer('turn_number').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload', { mode: 'json' }),
})

// --- Relations ---

export const trainersRelations = relations(trainers, ({ many }) => ({
  pokemon: many(pokemon),
  teamPairingsA: many(teamPairings, { relationName: 'trainerA' }),
  teamPairingsB: many(teamPairings, { relationName: 'trainerB' }),
}))

export const seasonsRelations = relations(seasons, ({ many }) => ({
  pokemon: many(pokemon),
  weeks: many(weeks),
}))

export const pokemonRelations = relations(pokemon, ({ one, many }) => ({
  season: one(seasons, { fields: [pokemon.seasonId], references: [seasons.id] }),
  trainer: one(trainers, { fields: [pokemon.trainerId], references: [trainers.id] }),
  gameStats: many(pokemonGameStats),
}))

export const weeksRelations = relations(weeks, ({ one, many }) => ({
  season: one(seasons, { fields: [weeks.seasonId], references: [seasons.id] }),
  teamPairings: many(teamPairings),
  matches: many(matches),
}))

export const teamPairingsRelations = relations(teamPairings, ({ one }) => ({
  week: one(weeks, { fields: [teamPairings.weekId], references: [weeks.id] }),
  trainerA: one(trainers, { fields: [teamPairings.trainerAId], references: [trainers.id], relationName: 'trainerA' }),
  trainerB: one(trainers, { fields: [teamPairings.trainerBId], references: [trainers.id], relationName: 'trainerB' }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => ({
  week: one(weeks, { fields: [matches.weekId], references: [weeks.id] }),
  pairingA: one(teamPairings, { fields: [matches.pairingAId], references: [teamPairings.id], relationName: 'pairingA' }),
  pairingB: one(teamPairings, { fields: [matches.pairingBId], references: [teamPairings.id], relationName: 'pairingB' }),
  games: many(games),
}))

export const gamesRelations = relations(games, ({ one, many }) => ({
  match: one(matches, { fields: [games.matchId], references: [matches.id] }),
  winner: one(trainers, { fields: [games.winnerId], references: [trainers.id] }),
  battleLog: one(battleLogs),
  pokemonGameStats: many(pokemonGameStats),
  turnEvents: many(turnEvents),
}))

export const battleLogsRelations = relations(battleLogs, ({ one }) => ({
  game: one(games, { fields: [battleLogs.gameId], references: [games.id] }),
}))

export const pokemonGameStatsRelations = relations(pokemonGameStats, ({ one }) => ({
  game: one(games, { fields: [pokemonGameStats.gameId], references: [games.id] }),
  pokemon: one(pokemon, { fields: [pokemonGameStats.pokemonId], references: [pokemon.id] }),
  trainer: one(trainers, { fields: [pokemonGameStats.trainerId], references: [trainers.id] }),
}))

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  game: one(games, { fields: [turnEvents.gameId], references: [games.id] }),
}))
