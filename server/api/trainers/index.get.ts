import { createTrainerService } from '../../services/trainers'
import { db } from '../../db'

export default defineEventHandler(() => {
  const service = createTrainerService(db)
  return service.list()
})
