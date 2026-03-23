import { createTrainerService } from '../../services/trainers'
import { db } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string }>(event)
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  const service = createTrainerService(db)
  try {
    return service.create({ name: body.name.trim() })
  }
  catch (error) {
    if (error instanceof Error && /duplicate/i.test(error.message)) {
      throw createError({ statusCode: 409, statusMessage: error.message })
    }
    throw error
  }
})
