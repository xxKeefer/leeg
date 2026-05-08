<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api/client";

interface Player {
  id: string;
  name: string;
  showdownName: string;
}

interface League {
  id: string;
  name: string;
  format: string;
  status: string;
  players: Player[];
}

const route = useRoute();
const league = ref<League | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const playerName = ref("");
const showdownName = ref("");
const enrolling = ref(false);
const enrollError = ref<string | null>(null);

const isDraft = computed(() => league.value?.status === "draft");

async function fetchLeague() {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiFetch<{ league: League }>(`/leagues/${route.params.id}`);
    league.value = data.league;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load league";
  } finally {
    loading.value = false;
  }
}

async function enrollPlayer() {
  enrolling.value = true;
  enrollError.value = null;
  try {
    const data = await apiFetch<{ player: Player }>(`/leagues/${route.params.id}/players`, {
      method: "POST",
      body: JSON.stringify({ name: playerName.value, showdownName: showdownName.value }),
    });
    league.value?.players.push(data.player);
    playerName.value = "";
    showdownName.value = "";
  } catch (e) {
    enrollError.value = e instanceof Error ? e.message : "Failed to enroll player";
  } finally {
    enrolling.value = false;
  }
}

async function removePlayer(playerId: string) {
  try {
    await apiFetch(`/leagues/${route.params.id}/players/${playerId}`, { method: "DELETE" });
    if (league.value) {
      league.value.players = league.value.players.filter((p) => p.id !== playerId);
    }
  } catch (e) {
    enrollError.value = e instanceof Error ? e.message : "Failed to remove player";
  }
}

function copyShowdownName(name: string) {
  navigator.clipboard.writeText(name);
}

onMounted(fetchLeague);
</script>

<template>
  <div class="max-w-2xl mx-auto mt-10">
    <div v-if="loading" class="text-center text-gray-500">Loading...</div>
    <div v-else-if="error" class="text-center text-red-600">{{ error }}</div>
    <div v-else-if="league">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">{{ league.name }}</h1>
          <p class="text-gray-500 text-sm">
            {{ league.format.toUpperCase() }} &middot;
            <span
              :class="{
                'text-yellow-600': league.status === 'draft',
                'text-green-600': league.status === 'active',
                'text-purple-600': league.status === 'finale',
                'text-gray-600': league.status === 'complete',
              }"
            >
              {{ league.status }}
            </span>
          </p>
        </div>
      </div>

      <section class="mb-8">
        <h2 class="text-lg font-semibold mb-3">
          Roster ({{ league.players.length }}/16)
        </h2>

        <div v-if="league.players.length === 0" class="text-gray-500 text-sm mb-4">
          No players enrolled yet.
        </div>

        <div class="space-y-2 mb-4">
          <div
            v-for="player in league.players"
            :key="player.id"
            class="flex items-center justify-between p-3 bg-white rounded border"
          >
            <div>
              <span class="font-medium">{{ player.name }}</span>
              <button
                class="ml-3 text-sm text-blue-500 hover:underline"
                :title="`Copy: ${player.showdownName}`"
                @click="copyShowdownName(player.showdownName)"
              >
                {{ player.showdownName }}
              </button>
            </div>
            <button
              v-if="isDraft"
              class="text-red-500 hover:text-red-700 text-sm"
              @click="removePlayer(player.id)"
            >
              Remove
            </button>
          </div>
        </div>
      </section>

      <section v-if="isDraft">
        <h2 class="text-lg font-semibold mb-3">Enroll Player</h2>

        <form class="flex gap-2 items-end" @submit.prevent="enrollPlayer">
          <div class="flex-1">
            <label for="player-name" class="block text-sm font-medium mb-1">Name</label>
            <input
              id="player-name"
              v-model="playerName"
              type="text"
              required
              placeholder="Player name"
              class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="flex-1">
            <label for="showdown-name" class="block text-sm font-medium mb-1">Showdown Username</label>
            <input
              id="showdown-name"
              v-model="showdownName"
              type="text"
              required
              placeholder="Showdown username"
              class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            :disabled="enrolling || !playerName.trim() || !showdownName.trim()"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {{ enrolling ? "..." : "Add" }}
          </button>
        </form>

        <p v-if="enrollError" class="text-red-600 text-sm mt-2">{{ enrollError }}</p>
      </section>
    </div>
  </div>
</template>
