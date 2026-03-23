<script setup lang="ts">
import type { FetchError } from 'ofetch'

const { data: trainers, refresh } = await useFetch('/api/trainers')

const showForm = ref(false)
const editingId = ref<number | null>(null)
const trainerName = ref('')
const formError = ref('')
const deleteErrors = ref<Record<number, string>>({})

function startCreate() {
  editingId.value = null
  trainerName.value = ''
  formError.value = ''
  showForm.value = true
}

function startEdit(trainer: { id: number; name: string }) {
  editingId.value = trainer.id
  trainerName.value = trainer.name
  formError.value = ''
  showForm.value = true
}

async function save() {
  const name = trainerName.value.trim()
  if (!name) return
  formError.value = ''
  try {
    if (editingId.value) {
      await $fetch(`/api/trainers/${editingId.value}`, { method: 'PUT', body: { name } })
    }
    else {
      await $fetch('/api/trainers', { method: 'POST', body: { name } })
    }
    showForm.value = false
    trainerName.value = ''
    editingId.value = null
    await refresh()
  }
  catch (error) {
    formError.value = (error as FetchError).data?.statusMessage ?? 'Something went wrong'
  }
}

async function remove(id: number) {
  deleteErrors.value = { ...deleteErrors.value, [id]: '' }
  try {
    await $fetch(`/api/trainers/${id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (error) {
    deleteErrors.value = {
      ...deleteErrors.value,
      [id]: (error as FetchError).data?.statusMessage ?? 'Something went wrong',
    }
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Trainers</h1>
      <button
        class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        @click="startCreate"
      >
        Add Trainer
      </button>
    </div>

    <div v-if="showForm" class="mb-6 p-4 bg-gray-800 rounded">
      <h2 class="text-lg font-semibold mb-2">{{ editingId ? 'Edit' : 'Add' }} Trainer</h2>
      <form class="flex gap-2" @submit.prevent="save">
        <input
          v-model="trainerName"
          type="text"
          placeholder="Trainer name"
          class="bg-gray-700 px-3 py-2 rounded flex-1"
        >
        <button type="submit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
          Save
        </button>
        <button
          type="button"
          class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
          @click="showForm = false"
        >
          Cancel
        </button>
      </form>
      <p v-if="formError" class="mt-2 text-red-400 text-sm">{{ formError }}</p>
    </div>

    <div v-if="trainers?.length" class="space-y-2">
      <div
        v-for="trainer in trainers"
        :key="trainer.id"
        class="p-3 bg-gray-800 rounded"
      >
        <div class="flex items-center justify-between">
          <span>{{ trainer.name }}</span>
          <div class="flex gap-2">
            <button
              class="text-blue-400 hover:text-blue-300 text-sm"
              @click="startEdit(trainer)"
            >
              Edit
            </button>
            <button
              class="text-red-400 hover:text-red-300 text-sm"
              @click="remove(trainer.id)"
            >
              Delete
            </button>
          </div>
        </div>
        <p v-if="deleteErrors[trainer.id]" class="mt-1 text-red-400 text-sm">
          {{ deleteErrors[trainer.id] }}
        </p>
      </div>
    </div>
    <p v-else class="text-gray-400">No trainers yet.</p>
  </div>
</template>
