import { eq, and } from 'drizzle-orm'
import { seasons, pokemon } from '../db/schema'
import type { Db } from '../db/types'
import type { createPokeApiService } from './pokeapi'

type PokeApiService = ReturnType<typeof createPokeApiService>

export function createSeasonService(db: Db, pokeApi?: PokeApiService) {
  return {
    create(data: { name: string }) {
      return db.insert(seasons).values({ name: data.name }).returning().get()
    },

    list() {
      return db.select().from(seasons).all()
    },

    async addToRoster(data: { seasonId: number; trainerId: number; species: string }) {
      const normalised = data.species.toLowerCase().trim()

      if (pokeApi) {
        const valid = await pokeApi.isValidSpecies(normalised)
        if (!valid) throw new Error(`Invalid Pokemon species: ${data.species}`)
      }

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
        species: normalised,
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

    remove(id: number) {
      db.delete(pokemon).where(eq(pokemon.seasonId, id)).run()
      const result = db.delete(seasons).where(eq(seasons.id, id)).run()
      return result.changes > 0
    },
  }
}
