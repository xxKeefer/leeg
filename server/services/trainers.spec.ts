import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, type Db } from '../db/test-utils'
import { createTrainerService } from './trainers'
import { createSeasonService } from './seasons'

describe('trainerService', () => {
  let db: Db
  let service: ReturnType<typeof createTrainerService>

  beforeEach(() => {
    db = createTestDb()
    service = createTrainerService(db)
  })

  describe('create', () => {
    it('creates a trainer and returns it', () => {
      const trainer = service.create({ name: 'Ash' })
      expect(trainer.name).toBe('Ash')
      expect(trainer.id).toBeDefined()
    })

    it('rejects duplicate names', () => {
      service.create({ name: 'Ash' })
      expect(() => service.create({ name: 'Ash' })).toThrow(/duplicate/i)
    })
  })

  describe('list', () => {
    it('returns all trainers', () => {
      service.create({ name: 'Ash' })
      service.create({ name: 'Misty' })
      const trainers = service.list()
      expect(trainers).toHaveLength(2)
    })
  })

  describe('getById', () => {
    it('returns a trainer by id', () => {
      const created = service.create({ name: 'Ash' })
      const found = service.getById(created.id)
      expect(found?.name).toBe('Ash')
    })

    it('returns null for missing id', () => {
      expect(service.getById(999)).toBeNull()
    })
  })

  describe('update', () => {
    it('updates a trainer name', () => {
      const created = service.create({ name: 'Ash' })
      const updated = service.update(created.id, { name: 'Ash Ketchum' })
      expect(updated?.name).toBe('Ash Ketchum')
    })

    it('returns null for missing id', () => {
      expect(service.update(999, { name: 'Nobody' })).toBeNull()
    })

    it('rejects duplicate names on update', () => {
      service.create({ name: 'Ash' })
      const misty = service.create({ name: 'Misty' })
      expect(() => service.update(misty.id, { name: 'Ash' })).toThrow(/duplicate/i)
    })
  })

  describe('remove', () => {
    it('deletes a trainer', () => {
      const created = service.create({ name: 'Ash' })
      const removed = service.remove(created.id)
      expect(removed).toBe(true)
      expect(service.getById(created.id)).toBeNull()
    })

    it('returns false for missing id', () => {
      expect(service.remove(999)).toBe(false)
    })

    it('throws when trainer has roster entries', async () => {
      const trainer = service.create({ name: 'Ash' })
      const seasonService = createSeasonService(db)
      const season = seasonService.create({ name: 'Season 1' })
      await seasonService.addToRoster({ seasonId: season.id, trainerId: trainer.id, species: 'Pikachu' })
      expect(() => service.remove(trainer.id)).toThrow(/roster/i)
    })
  })
})
