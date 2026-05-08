<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api/client";

interface Player {
  id: string;
  name: string;
  showdownName: string;
}

interface Match {
  id: string;
  team1Player1: string | null;
  team1Player2: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  isBye: boolean;
  result: string | null;
}

interface Round {
  id: string;
  roundNumber: number;
  roundType: string;
  status: string;
  matches: Match[];
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
const schedule = ref<Round[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const playerName = ref("");
const showdownName = ref("");
const enrolling = ref(false);
const enrollError = ref<string | null>(null);
const generating = ref(false);
const generateError = ref<string | null>(null);

const isDraft = computed(() => league.value?.status === "draft");
const playerMap = computed(() => {
  const map = new Map<string, string>();
  if (league.value) {
    for (const p of league.value.players) {
      map.set(p.id, p.name);
    }
  }
  return map;
});

function playerName2(id: string | null): string {
  if (!id) return "";
  return playerMap.value.get(id) ?? id;
}

async function fetchLeague() {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiFetch<{ league: League }>(`/leagues/${route.params.id}`);
    league.value = data.league;
    if (data.league.status !== "draft") {
      await fetchSchedule();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load league";
  } finally {
    loading.value = false;
  }
}

async function fetchSchedule() {
  try {
    const data = await apiFetch<{ rounds: Round[] }>(`/leagues/${route.params.id}/schedule`);
    schedule.value = data.rounds;
  } catch {
    // Schedule may not exist yet
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

async function generateSchedule() {
  generating.value = true;
  generateError.value = null;
  try {
    await apiFetch(`/leagues/${route.params.id}/generate`, { method: "POST" });
    if (league.value) {
      league.value.status = "active";
    }
    await fetchSchedule();
  } catch (e) {
    generateError.value = e instanceof Error ? e.message : "Failed to generate schedule";
  } finally {
    generating.value = false;
  }
}

function copyShowdownName(name: string) {
  navigator.clipboard.writeText(name);
}

onMounted(fetchLeague);
</script>

<template>
  <div class="max-w-4xl mx-auto mt-10">
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
        <button
          v-if="isDraft && league.players.length >= 4"
          :disabled="generating"
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          @click="generateSchedule"
        >
          {{ generating ? "Generating..." : "Generate Schedule" }}
        </button>
      </div>

      <p v-if="generateError" class="text-red-600 text-sm mb-4">{{ generateError }}</p>

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

      <section v-if="schedule.length > 0" class="mt-8">
        <h2 class="text-lg font-semibold mb-3">Schedule</h2>

        <div class="space-y-4">
          <div
            v-for="round in schedule"
            :key="round.id"
            class="border rounded bg-white p-4"
          >
            <h3 class="font-medium mb-2">
              Round {{ round.roundNumber }}
              <span class="text-sm text-gray-500 ml-2">{{ round.status }}</span>
            </h3>

            <div class="space-y-2">
              <div
                v-for="match in round.matches"
                :key="match.id"
                class="flex items-center gap-2 text-sm"
              >
                <template v-if="match.isBye">
                  <span class="text-gray-500 italic">
                    BYE:
                    {{ playerName2(match.team1Player1) }}
                    <template v-if="match.team1Player2">
                      &amp; {{ playerName2(match.team1Player2) }}
                    </template>
                  </span>
                </template>
                <template v-else>
                  <span class="font-medium">
                    {{ playerName2(match.team1Player1) }} &amp; {{ playerName2(match.team1Player2) }}
                  </span>
                  <span class="text-gray-400">vs</span>
                  <span class="font-medium">
                    {{ playerName2(match.team2Player1) }} &amp; {{ playerName2(match.team2Player2) }}
                  </span>
                  <span v-if="match.result" class="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    {{ match.result }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
