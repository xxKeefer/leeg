<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
}>()

const model = defineModel<string>({ default: '' })

const { data: allSpecies } = await useFetch<string[]>('/api/pokemon/species')

const query = ref('')
const showSuggestions = ref(false)
const highlightIndex = ref(-1)

const filtered = computed(() => {
  const q = query.value.toLowerCase()
  if (!q || !allSpecies.value) return []
  return allSpecies.value
    .filter(s => s.startsWith(q))
    .slice(0, 10)
})

function selectSpecies(species: string) {
  model.value = species
  query.value = species
  showSuggestions.value = false
  highlightIndex.value = -1
}

function onInput() {
  model.value = ''
  showSuggestions.value = query.value.length > 0
  highlightIndex.value = -1
}

function onKeydown(e: KeyboardEvent) {
  if (!showSuggestions.value || !filtered.value.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, filtered.value.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  }
  else if (e.key === 'Enter' && highlightIndex.value >= 0) {
    e.preventDefault()
    selectSpecies(filtered.value[highlightIndex.value]!)
  }
}

function onBlur() {
  setTimeout(() => { showSuggestions.value = false }, 150)
}
</script>

<template>
  <div class="relative flex-1">
    <input
      v-model="query"
      type="text"
      placeholder="Pokemon species"
      class="bg-gray-700 px-3 py-2 rounded w-full"
      :disabled="props.disabled"
      autocomplete="off"
      @input="onInput"
      @focus="showSuggestions = query.length > 0"
      @blur="onBlur"
      @keydown="onKeydown"
    >
    <ul
      v-if="showSuggestions && filtered.length"
      class="absolute z-10 mt-1 w-full bg-gray-700 rounded shadow-lg max-h-48 overflow-y-auto"
    >
      <li
        v-for="(species, i) in filtered"
        :key="species"
        class="px-3 py-1 cursor-pointer capitalize"
        :class="i === highlightIndex ? 'bg-blue-600' : 'hover:bg-gray-600'"
        @mousedown.prevent="selectSpecies(species)"
      >
        {{ species }}
      </li>
    </ul>
  </div>
</template>
