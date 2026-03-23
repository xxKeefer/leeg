interface PokeApiResponse {
  results: Array<{ name: string; url: string }>
}

type Fetcher = (url: string) => Promise<PokeApiResponse>

const POKEAPI_URL = 'https://pokeapi.co/api/v2/pokemon?limit=2000'

export function createPokeApiService(fetcher: Fetcher = defaultFetcher) {
  let cache: string[] | null = null

  return {
    async getSpeciesList(): Promise<string[]> {
      if (cache) return cache
      const data = await fetcher(POKEAPI_URL)
      cache = data.results.map(r => r.name)
      return cache
    },

    async isValidSpecies(species: string): Promise<boolean> {
      const list = await this.getSpeciesList()
      return list.includes(species.toLowerCase())
    },
  }
}

async function defaultFetcher(url: string): Promise<PokeApiResponse> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`PokeAPI request failed: ${response.status}`)
  return response.json() as Promise<PokeApiResponse>
}
