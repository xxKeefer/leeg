import { createTrainerService } from '../../services/trainers'
import { db } from '../../db'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const service = createTrainerService(db)
  const trainer = service.getById(id)
  if (!trainer) {
    throw createError({ statusCode: 404, statusMessage: 'Trainer not found' })
  }
  return trainer
})
