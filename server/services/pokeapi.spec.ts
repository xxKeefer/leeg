import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPokeApiService } from './pokeapi'

function mockFetcher(species: string[]) {
  return vi.fn().mockResolvedValue({
    results: species.map(name => ({ name, url: `https://pokeapi.co/api/v2/pokemon/${name}` })),
  })
}

describe('pokeApiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and returns species names', async () => {
    const fetcher = mockFetcher(['bulbasaur', 'charmander', 'squirtle'])
    const service = createPokeApiService(fetcher)
    const species = await service.getSpeciesList()
    expect(species).toEqual(['bulbasaur', 'charmander', 'squirtle'])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('caches the result after first fetch', async () => {
    const fetcher = mockFetcher(['bulbasaur'])
    const service = createPokeApiService(fetcher)
    await service.getSpeciesList()
    await service.getSpeciesList()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('validates species names', async () => {
    const fetcher = mockFetcher(['bulbasaur', 'charmander'])
    const service = createPokeApiService(fetcher)
    expect(await service.isValidSpecies('bulbasaur')).toBe(true)
    expect(await service.isValidSpecies('Bulbasaur')).toBe(true)
    expect(await service.isValidSpecies('fakemon')).toBe(false)
  })
})
