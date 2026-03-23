import { createSeasonService } from '../../../services/seasons'
import { db } from '../../../db'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid season id' })
  }
  const service = createSeasonService(db)
  return service.getRosters(id)
})
