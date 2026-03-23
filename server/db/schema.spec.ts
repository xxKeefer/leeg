import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './server/db/migrations' })
  return db
}

describe('schema', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('inserts and reads a trainer', () => {
    db.insert(schema.trainers).values({ name: 'Ash' }).run()
    const rows = db.select().from(schema.trainers).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Ash')
    expect(rows[0]!.id).toBe(1)
  })

  it('enforces unique trainer names', () => {
    db.insert(schema.trainers).values({ name: 'Ash' }).run()
    expect(() => db.insert(schema.trainers).values({ name: 'Ash' }).run())
      .toThrow()
  })

  it('inserts a season with pokemon roster', () => {
    db.insert(schema.trainers).values({ name: 'Ash' }).run()
    db.insert(schema.seasons).values({ name: 'Season 1' }).run()
    db.insert(schema.pokemon).values({
      seasonId: 1,
      trainerId: 1,
      species: 'Pikachu',
      cost: 10,
    }).run()

    const rows = db.select().from(schema.pokemon).where(eq(schema.pokemon.trainerId, 1)).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.species).toBe('Pikachu')
  })

  it('creates all 10 tables', () => {
    const tables = [
      schema.trainers, schema.seasons, schema.pokemon, schema.weeks,
      schema.teamPairings, schema.matches, schema.games,
      schema.battleLogs, schema.pokemonGameStats, schema.turnEvents,
    ]
    for (const table of tables) {
      const rows = db.select().from(table).all()
      expect(rows).toEqual([])
    }
  })
})
