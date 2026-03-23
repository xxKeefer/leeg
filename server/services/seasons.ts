import { eq, and } from 'drizzle-orm'
import { seasons, pokemon } from '../db/schema'
import type { Db } from '../db/types'

export function createSeasonService(db: Db) {
  return {
    create(data: { name: string }) {
      return db.insert(seasons).values({ name: data.name }).returning().get()
    },

    list() {
      return db.select().from(seasons).all()
    },

    addToRoster(data: { seasonId: number; trainerId: number; species: string }) {
      const existing = db.select().from(pokemon)
        .where(and(
          eq(pokemon.seasonId, data.seasonId),
          eq(pokemon.trainerId, data.trainerId),
        ))
        .all()
      if (existing.length >= 5) {
        throw new Error('A trainer can have at most 5 Pokemon per season')
      }
      return db.insert(pokemon).values({
        seasonId: data.seasonId,
        trainerId: data.trainerId,
        species: data.species,
      }).returning().get()
    },

    getRosters(seasonId: number) {
      const rows = db.select().from(pokemon).where(eq(pokemon.seasonId, seasonId)).all()
      const grouped = new Map<number, { trainerId: number; pokemon: typeof rows }>()
      for (const row of rows) {
        if (!grouped.has(row.trainerId)) {
          grouped.set(row.trainerId, { trainerId: row.trainerId, pokemon: [] })
        }
        grouped.get(row.trainerId)!.pokemon.push(row)
      }
      return [...grouped.values()]
    },

    removeFromRoster(pokemonId: number) {
      const result = db.delete(pokemon).where(eq(pokemon.id, pokemonId)).run()
      return result.changes > 0
    },
  }
}
