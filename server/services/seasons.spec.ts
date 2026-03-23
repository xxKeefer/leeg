import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb, type Db } from '../db/test-utils'
import { createSeasonService } from './seasons'
import { createTrainerService } from './trainers'
import { createPokeApiService } from './pokeapi'

const VALID_SPECIES = ['pikachu', 'charizard', 'blastoise', 'venusaur', 'gengar', 'mewtwo', 'starmie']

function mockPokeApi() {
  return createPokeApiService(
    vi.fn().mockResolvedValue({
      results: VALID_SPECIES.map(name => ({ name, url: '' })),
    }),
  )
}

describe('seasonService', () => {
  let db: Db
  let seasonService: ReturnType<typeof createSeasonService>
  let trainerService: ReturnType<typeof createTrainerService>

  beforeEach(() => {
    db = createTestDb()
    seasonService = createSeasonService(db, mockPokeApi())
    trainerService = createTrainerService(db)
  })

  describe('create', () => {
    it('creates a season with a name', () => {
      const season = seasonService.create({ name: 'Season 1' })
      expect(season.name).toBe('Season 1')
      expect(season.id).toBeDefined()
    })
  })

  describe('list', () => {
    it('returns all seasons', () => {
      seasonService.create({ name: 'Season 1' })
      seasonService.create({ name: 'Season 2' })
      const all = seasonService.list()
      expect(all).toHaveLength(2)
      expect(all.map(s => s.name)).toEqual(['Season 1', 'Season 2'])
    })
  })

  describe('remove', () => {
    it('deletes a season and its roster entries', async () => {
      const season = seasonService.create({ name: 'Season 1' })
      const trainer = trainerService.create({ name: 'Ash' })
      await seasonService.addToRoster({ seasonId: season.id, trainerId: trainer.id, species: 'pikachu' })

      const removed = seasonService.remove(season.id)
      expect(removed).toBe(true)
      expect(seasonService.list()).toHaveLength(0)
      expect(seasonService.getRosters(season.id)).toHaveLength(0)
    })

    it('returns false for missing id', () => {
      expect(seasonService.remove(999)).toBe(false)
    })
  })

  describe('roster', () => {
    let seasonId: number
    let trainerId: number

    beforeEach(() => {
      const trainer = trainerService.create({ name: 'Ash' })
      const season = seasonService.create({ name: 'Season 1' })
      trainerId = trainer.id
      seasonId = season.id
    })

    it('assigns a pokemon to a trainer', async () => {
      const entry = await seasonService.addToRoster({
        seasonId,
        trainerId,
        species: 'Pikachu',
      })
      expect(entry.species).toBe('pikachu')
      expect(entry.trainerId).toBe(trainerId)
    })

    it('normalises species to lowercase', async () => {
      const entry = await seasonService.addToRoster({ seasonId, trainerId, species: 'CHARIZARD' })
      expect(entry.species).toBe('charizard')
    })

    it('rejects invalid species', async () => {
      await expect(
        seasonService.addToRoster({ seasonId, trainerId, species: 'fakemon' }),
      ).rejects.toThrow(/invalid/i)
    })

    it('enforces max 5 pokemon per trainer per season', async () => {
      const species = ['pikachu', 'charizard', 'blastoise', 'venusaur', 'gengar']
      for (const s of species) {
        await seasonService.addToRoster({ seasonId, trainerId, species: s })
      }
      await expect(
        seasonService.addToRoster({ seasonId, trainerId, species: 'mewtwo' }),
      ).rejects.toThrow(/5/)
    })

    it('returns all trainers with their pokemon for a season', async () => {
      const misty = trainerService.create({ name: 'Misty' })
      await seasonService.addToRoster({ seasonId, trainerId, species: 'pikachu' })
      await seasonService.addToRoster({ seasonId, trainerId: misty.id, species: 'starmie' })

      const rosters = seasonService.getRosters(seasonId)
      expect(rosters).toHaveLength(2)
      const ashRoster = rosters.find(r => r.trainerId === trainerId)
      expect(ashRoster?.pokemon).toHaveLength(1)
      expect(ashRoster?.pokemon[0]!.species).toBe('pikachu')
    })

    it('removes a pokemon from a roster', async () => {
      const entry = await seasonService.addToRoster({ seasonId, trainerId, species: 'pikachu' })
      const removed = seasonService.removeFromRoster(entry.id)
      expect(removed).toBe(true)

      const rosters = seasonService.getRosters(seasonId)
      const ashRoster = rosters.find(r => r.trainerId === trainerId)
      expect(ashRoster).toBeUndefined()
    })

    it('returns false when removing nonexistent pokemon', () => {
      expect(seasonService.removeFromRoster(999)).toBe(false)
    })
  })
})
