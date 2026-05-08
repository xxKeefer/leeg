<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";

const router = useRouter();
const name = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit() {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiFetch<{ league: { id: string } }>("/leagues", {
      method: "POST",
      body: JSON.stringify({ name: name.value }),
    });
    router.push(`/leagues/${data.league.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to create league";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-md mx-auto mt-10">
    <h1 class="text-2xl font-bold mb-6">Create League</h1>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="league-name" class="block text-sm font-medium mb-1">League Name</label>
        <input
          id="league-name"
          v-model="name"
          type="text"
          required
          placeholder="e.g. Season 1"
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Format</label>
        <p class="px-3 py-2 bg-gray-100 rounded text-gray-700">2HG (Two Headed Giant)</p>
      </div>

      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading || !name.trim()"
        class="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {{ loading ? "Creating..." : "Create League" }}
      </button>
    </form>
  </div>
</template>
