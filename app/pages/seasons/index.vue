<script setup lang="ts">
import type { FetchError } from 'ofetch'

const { data: trainers } = await useFetch('/api/trainers')

const seasonName = ref('')
const { data: fetchedSeasons, refresh: refreshSeasons } = await useFetch<Array<{ id: number; name: string }>>('/api/seasons')
const selectedSeasonId = ref<number | null>(null)
const rosters = ref<Array<{ trainerId: number; pokemon: Array<{ id: number; species: string }> }>>([])

const seasons = computed(() => fetchedSeasons.value ?? [])

const assignTrainerId = ref<number | null>(null)
const assignSpecies = ref('')
const assignError = ref('')
const seasonError = ref('')

const MAX_ROSTER_SIZE = 5

function rosterForTrainer(trainerId: number | null) {
  if (!trainerId) return []
  return rosters.value.find(r => r.trainerId === trainerId)?.pokemon ?? []
}

const selectedTrainerAtLimit = computed(() =>
  rosterForTrainer(assignTrainerId.value).length >= MAX_ROSTER_SIZE,
)

async function createSeason() {
  const name = seasonName.value.trim()
  if (!name) return
  seasonError.value = ''
  try {
    const season = await $fetch('/api/seasons', { method: 'POST', body: { name } })
    seasonName.value = ''
    selectedSeasonId.value = season.id
    await refreshSeasons()
    await loadRosters()
  }
  catch (error) {
    seasonError.value = (error as FetchError).data?.statusMessage ?? 'Something went wrong'
  }
}

async function loadRosters() {
  if (!selectedSeasonId.value) return
  rosters.value = await $fetch(`/api/seasons/${selectedSeasonId.value}/rosters`)
}

async function assignPokemon() {
  if (!selectedSeasonId.value || !assignTrainerId.value || !assignSpecies.value.trim()) return
  assignError.value = ''
  try {
    await $fetch(`/api/seasons/${selectedSeasonId.value}/rosters`, {
      method: 'POST',
      body: { trainerId: assignTrainerId.value, species: assignSpecies.value.trim() },
    })
    assignSpecies.value = ''
    await loadRosters()
  }
  catch (error) {
    assignError.value = (error as FetchError).data?.statusMessage ?? 'Something went wrong'
  }
}

async function removePokemon(pokemonId: number) {
  if (!selectedSeasonId.value) return
  await $fetch(`/api/seasons/${selectedSeasonId.value}/rosters/${pokemonId}`, { method: 'DELETE' })
  await loadRosters()
}

function trainerName(trainerId: number): string {
  return trainers.value?.find(t => t.id === trainerId)?.name ?? `Trainer #${trainerId}`
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Seasons</h1>

    <div class="mb-6 p-4 bg-gray-800 rounded">
      <h2 class="text-lg font-semibold mb-2">Create Season</h2>
      <form class="flex gap-2" @submit.prevent="createSeason">
        <input
          v-model="seasonName"
          type="text"
          placeholder="Season name"
          class="bg-gray-700 px-3 py-2 rounded flex-1"
        >
        <button type="submit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
          Create
        </button>
      </form>
      <p v-if="seasonError" class="mt-2 text-red-400 text-sm">{{ seasonError }}</p>
    </div>

    <div v-if="seasons.length" class="mb-6">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="season in seasons"
          :key="season.id"
          class="px-3 py-1 rounded"
          :class="selectedSeasonId === season.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'"
          @click="selectedSeasonId = season.id; loadRosters()"
        >
          {{ season.name }}
        </button>
      </div>
    </div>

    <template v-if="selectedSeasonId">
      <div class="mb-6 p-4 bg-gray-800 rounded">
        <h2 class="text-lg font-semibold mb-2">Assign Pokemon</h2>
        <form class="flex gap-2" @submit.prevent="assignPokemon">
          <select
            v-model="assignTrainerId"
            class="bg-gray-700 px-3 py-2 rounded"
          >
            <option :value="null" disabled>Select trainer</option>
            <option v-for="t in trainers" :key="t.id" :value="t.id">
              {{ t.name }} ({{ rosterForTrainer(t.id).length }}/{{ MAX_ROSTER_SIZE }})
            </option>
          </select>
          <input
            v-model="assignSpecies"
            type="text"
            placeholder="Pokemon species"
            class="bg-gray-700 px-3 py-2 rounded flex-1"
            :disabled="selectedTrainerAtLimit"
          >
          <button
            type="submit"
            class="px-4 py-2 rounded"
            :class="selectedTrainerAtLimit
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700'"
            :disabled="selectedTrainerAtLimit"
          >
            Add
          </button>
        </form>
        <p v-if="selectedTrainerAtLimit" class="mt-2 text-yellow-400 text-sm">
          This trainer already has {{ MAX_ROSTER_SIZE }} Pokemon.
        </p>
        <p v-if="assignError" class="mt-2 text-red-400 text-sm">{{ assignError }}</p>
      </div>

      <div v-if="rosters.length" class="space-y-4">
        <div v-for="roster in rosters" :key="roster.trainerId" class="p-4 bg-gray-800 rounded">
          <h3 class="font-semibold mb-2">
            {{ trainerName(roster.trainerId) }}
            <span class="text-gray-400 text-sm font-normal">({{ roster.pokemon.length }}/{{ MAX_ROSTER_SIZE }})</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="pkmn in roster.pokemon"
              :key="pkmn.id"
              class="inline-flex items-center gap-1 bg-gray-700 px-3 py-1 rounded"
            >
              {{ pkmn.species }}
              <button
                class="text-red-400 hover:text-red-300 ml-1"
                @click="removePokemon(pkmn.id)"
              >
                ×
              </button>
            </span>
          </div>
          <p v-if="!roster.pokemon.length" class="text-gray-400 text-sm">No Pokemon assigned.</p>
        </div>
      </div>
      <p v-else class="text-gray-400">No rosters for this season yet.</p>
    </template>
  </div>
</template>
