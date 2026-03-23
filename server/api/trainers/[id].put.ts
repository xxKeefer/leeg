import { createTrainerService } from '../../services/trainers'
import { db } from '../../db'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const body = await readBody<{ name: string }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  const service = createTrainerService(db)
  try {
    const updated = service.update(id, { name: body.name.trim() })
    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Trainer not found' })
    }
    return updated
  }
  catch (error) {
    if (error instanceof Error && /duplicate/i.test(error.message)) {
      throw createError({ statusCode: 409, statusMessage: error.message })
    }
    throw error
  }
})
