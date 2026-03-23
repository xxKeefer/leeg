import { eq } from 'drizzle-orm'
import { trainers } from '../db/schema'
import type { Db } from '../db/types'

export function createTrainerService(db: Db) {
  return {
    create(data: { name: string }) {
      const existing = db.select().from(trainers).where(eq(trainers.name, data.name)).get()
      if (existing) throw new Error(`Duplicate trainer name: ${data.name}`)
      return db.insert(trainers).values({ name: data.name }).returning().get()
    },

    list() {
      return db.select().from(trainers).all()
    },

    getById(id: number) {
      return db.select().from(trainers).where(eq(trainers.id, id)).get() ?? null
    },

    update(id: number, data: { name: string }) {
      const existing = db.select().from(trainers).where(eq(trainers.id, id)).get()
      if (!existing) return null
      const duplicate = db.select().from(trainers).where(eq(trainers.name, data.name)).get()
      if (duplicate && duplicate.id !== id) throw new Error(`Duplicate trainer name: ${data.name}`)
      return db.update(trainers).set({ name: data.name }).where(eq(trainers.id, id)).returning().get() ?? null
    },

    remove(id: number) {
      const result = db.delete(trainers).where(eq(trainers.id, id)).run()
      return result.changes > 0
    },
  }
}
