import { createSeasonService } from '../../services/seasons'
import { db } from '../../db'

export default defineEventHandler(() => {
  const service = createSeasonService(db)
  return service.list()
})
