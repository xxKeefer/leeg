import { createSeasonService } from '../../../../services/seasons'
import { db } from '../../../../db'

export default defineEventHandler((event) => {
  const pokemonId = Number(getRouterParam(event, 'pokemonId'))
  if (Number.isNaN(pokemonId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid pokemon id' })
  }
  const service = createSeasonService(db)
  const removed = service.removeFromRoster(pokemonId)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Pokemon not found' })
  }
  return { success: true }
})
