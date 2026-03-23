import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, type Db } from '../db/test-utils'
import { createSeasonService } from './seasons'
import { createTrainerService } from './trainers'

describe('seasonService', () => {
  let db: Db
  let seasonService: ReturnType<typeof createSeasonService>
  let trainerService: ReturnType<typeof createTrainerService>

  beforeEach(() => {
    db = createTestDb()
    seasonService = createSeasonService(db)
    trainerService = createTrainerService(db)
  })

  describe('create', () => {
    it('creates a season with a name', () => {
      const season = seasonService.create({ name: 'Season 1' })
      expect(season.name).toBe('Season 1')
      expect(season.id).toBeDefined()
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

    it('assigns a pokemon to a trainer', () => {
      const entry = seasonService.addToRoster({
        seasonId,
        trainerId,
        species: 'Pikachu',
      })
      expect(entry.species).toBe('Pikachu')
      expect(entry.trainerId).toBe(trainerId)
    })

    it('enforces max 5 pokemon per trainer per season', () => {
      const species = ['Pikachu', 'Charizard', 'Blastoise', 'Venusaur', 'Gengar']
      for (const s of species) {
        seasonService.addToRoster({ seasonId, trainerId, species: s })
      }
      expect(() =>
        seasonService.addToRoster({ seasonId, trainerId, species: 'Mewtwo' }),
      ).toThrow(/5/)
    })

    it('returns all trainers with their pokemon for a season', () => {
      const misty = trainerService.create({ name: 'Misty' })
      seasonService.addToRoster({ seasonId, trainerId, species: 'Pikachu' })
      seasonService.addToRoster({ seasonId, trainerId: misty.id, species: 'Starmie' })

      const rosters = seasonService.getRosters(seasonId)
      expect(rosters).toHaveLength(2)
      const ashRoster = rosters.find(r => r.trainerId === trainerId)
      expect(ashRoster?.pokemon).toHaveLength(1)
      expect(ashRoster?.pokemon[0]!.species).toBe('Pikachu')
    })

    it('removes a pokemon from a roster', () => {
      const entry = seasonService.addToRoster({ seasonId, trainerId, species: 'Pikachu' })
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
