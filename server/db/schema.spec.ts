import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { createTestDb, type Db } from './test-utils'

describe('schema', () => {
  let db: Db

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
