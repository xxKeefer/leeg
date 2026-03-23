import { createSeasonService } from '../../services/seasons'
import { db } from '../../db'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const service = createSeasonService(db)
  const removed = service.remove(id)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Season not found' })
  }
  return { success: true }
})
