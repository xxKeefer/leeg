import { pokeApiService } from '../../services/pokeapi.singleton'

export default defineEventHandler(async () => {
  return pokeApiService.getSpeciesList()
})
