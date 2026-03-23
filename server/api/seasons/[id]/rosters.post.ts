import { createSeasonService } from '../../../services/seasons'
import { db } from '../../../db'

export default defineEventHandler(async (event) => {
  const seasonId = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(seasonId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid season id' })
  }
  const body = await readBody<{ trainerId: number; species: string }>(event)
  if (!body?.trainerId || !body?.species?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'trainerId and species are required' })
  }
  const service = createSeasonService(db)
  try {
    return service.addToRoster({
      seasonId,
      trainerId: body.trainerId,
      species: body.species.trim(),
    })
  }
  catch (error) {
    if (error instanceof Error && /5/.test(error.message)) {
      throw createError({ statusCode: 422, statusMessage: error.message })
    }
    throw error
  }
})
