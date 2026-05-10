<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiFetch } from "../api/client";

interface Trainer {
  id: string;
  name: string;
  showdownName: string;
}

interface Match {
  id: string;
  matchNumber: number;
  winner: string | null;
  duo1Kos: number;
  duo2Kos: number;
  replayUrl: string | null;
}

interface FfaParticipant {
  id: string;
  trainerId: string;
  placement: number | null;
}

interface GameSet {
  id: string;
  setType: string;
  duo1Trainer1: string | null;
  duo1Trainer2: string | null;
  duo2Trainer1: string | null;
  duo2Trainer2: string | null;
  isBye: boolean;
  result: string | null;
  matches: Match[];
  ffaParticipants?: FfaParticipant[];
}

interface Round {
  id: string;
  roundNumber: number;
  roundType: string;
  status: string;
  sets: GameSet[];
}

interface League {
  id: string;
  name: string;
  format: string;
  status: string;
  trainers: Trainer[];
}

interface StandingEntry {
  trainerId: string;
  trainerName: string;
  showdownName: string;
  points: number;
  koDifferential: number;
  rank: number;
  isFinalist: boolean;
}

const route = useRoute();
const router = useRouter();
const league = ref<League | null>(null);
const schedule = ref<Round[]>([]);
const standings = ref<StandingEntry[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const trainerName = ref("");
const showdownName = ref("");
const enrolling = ref(false);
const enrollError = ref<string | null>(null);
const generating = ref(false);
const generateError = ref<string | null>(null);

const expandedSet = ref<string | null>(null);
const matchInputs = ref<Record<string, { winner: string; duo1Kos: number; duo2Kos: number }>>({});
const replayInputs = ref<Record<string, string>>({});
const replaySubmitting = ref<Record<string, boolean>>({});
const replayError = ref<Record<string, string>>({});
const generatingFinale = ref(false);
const finaleError = ref<string | null>(null);
const deleting = ref(false);
const confirmDelete = ref(false);
const editingMatchup = ref<string | null>(null);
const matchupInputs = ref<Record<string, { d1t1: string; d1t2: string; d2t1: string; d2t2: string }>>({});
const placementInputs = ref<Record<string, number>>({});
const submittingPlacements = ref(false);

function getMatchInput(matchId: string) {
  if (!matchInputs.value[matchId]) {
    matchInputs.value[matchId] = { winner: "", duo1Kos: 0, duo2Kos: 0 };
  }
  return matchInputs.value[matchId];
}

function onWinnerChange(matchId: string) {
  const input = getMatchInput(matchId);
  if (input.winner === "duo1") {
    input.duo1Kos = 6;
  } else if (input.winner === "duo2") {
    input.duo2Kos = 6;
  }
}

const isDraft = computed(() => league.value?.status === "draft");
const isActive = computed(
  () => league.value?.status === "active" || league.value?.status === "finale",
);
const trainerMap = computed(() => {
  const map = new Map<string, string>();
  if (league.value) {
    for (const t of league.value.trainers) {
      map.set(t.id, t.name);
    }
  }
  return map;
});

const canGenerateFinale = computed(() => {
  if (league.value?.status !== "active") return false;
  const regularRounds = schedule.value.filter((r) => r.roundType === "regular");
  if (regularRounds.length === 0) return false;
  return regularRounds.every((r) =>
    r.sets.every((s) => s.isBye || s.result !== null),
  );
});

const isFinale = computed(() => league.value?.status === "finale");

function tName(id: string | null): string {
  if (!id) return "";
  return trainerMap.value.get(id) ?? id;
}

function toggleSet(setId: string) {
  expandedSet.value = expandedSet.value === setId ? null : setId;
}

async function fetchLeague() {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiFetch<{ league: League }>(`/leagues/${route.params.id}`);
    league.value = data.league;
    if (data.league.status !== "draft") {
      await Promise.all([fetchSchedule(), fetchStandings()]);
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

async function fetchStandings() {
  try {
    const data = await apiFetch<{ standings: StandingEntry[] }>(
      `/leagues/${route.params.id}/standings`,
    );
    standings.value = data.standings;
  } catch {
    // Standings may not exist yet
  }
}

async function enrollTrainer() {
  enrolling.value = true;
  enrollError.value = null;
  try {
    const data = await apiFetch<{ trainer: Trainer }>(`/leagues/${route.params.id}/trainers`, {
      method: "POST",
      body: JSON.stringify({ name: trainerName.value, showdownName: showdownName.value }),
    });
    league.value?.trainers.push(data.trainer);
    trainerName.value = "";
    showdownName.value = "";
  } catch (e) {
    enrollError.value = e instanceof Error ? e.message : "Failed to enroll trainer";
  } finally {
    enrolling.value = false;
  }
}

async function removeTrainer(trainerId: string) {
  try {
    await apiFetch(`/leagues/${route.params.id}/trainers/${trainerId}`, { method: "DELETE" });
    if (league.value) {
      league.value.trainers = league.value.trainers.filter((t) => t.id !== trainerId);
    }
  } catch (e) {
    enrollError.value = e instanceof Error ? e.message : "Failed to remove trainer";
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
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    generateError.value = e instanceof Error ? e.message : "Failed to generate schedule";
  } finally {
    generating.value = false;
  }
}

async function submitMatchResult(matchId: string, winner: string, duo1Kos: number, duo2Kos: number) {
  try {
    await apiFetch(`/leagues/${route.params.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner, duo1Kos, duo2Kos }),
    });
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to submit match result";
  }
}

async function submitReplay(setId: string, matchId: string, matchNumber: number) {
  const url = replayInputs.value[matchId];
  if (!url) return;
  replaySubmitting.value[matchId] = true;
  replayError.value[matchId] = "";
  try {
    await apiFetch(`/leagues/${route.params.id}/sets/${setId}/matches`, {
      method: "POST",
      body: JSON.stringify({ replayUrl: url, matchNumber }),
    });
    replayInputs.value[matchId] = "";
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    replayError.value[matchId] = e instanceof Error ? e.message : "Failed to submit replay";
  } finally {
    replaySubmitting.value[matchId] = false;
  }
}

async function generateFinale() {
  generatingFinale.value = true;
  finaleError.value = null;
  try {
    await apiFetch(`/leagues/${route.params.id}/finale`, { method: "POST" });
    if (league.value) {
      league.value.status = "finale";
    }
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    finaleError.value = e instanceof Error ? e.message : "Failed to generate finale";
  } finally {
    generatingFinale.value = false;
  }
}

async function submitPlacements(setId: string, participants: FfaParticipant[]) {
  submittingPlacements.value = true;
  try {
    const placements = participants.map((p) => ({
      trainerId: p.trainerId,
      placement: placementInputs.value[p.trainerId],
    }));
    await apiFetch(`/leagues/${route.params.id}/sets/${setId}/placements`, {
      method: "PATCH",
      body: JSON.stringify({ placements }),
    });
    if (league.value) {
      league.value.status = "complete";
    }
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to submit placements";
  } finally {
    submittingPlacements.value = false;
  }
}

async function overrideSetResult(setId: string, result: string) {
  try {
    await apiFetch(`/leagues/${route.params.id}/sets/${setId}`, {
      method: "PATCH",
      body: JSON.stringify({ result }),
    });
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to override set result";
  }
}

function startEditMatchup(set: GameSet) {
  editingMatchup.value = set.id;
  matchupInputs.value[set.id] = {
    d1t1: set.duo1Trainer1 ?? "",
    d1t2: set.duo1Trainer2 ?? "",
    d2t1: set.duo2Trainer1 ?? "",
    d2t2: set.duo2Trainer2 ?? "",
  };
}

async function saveMatchup(setId: string) {
  const input = matchupInputs.value[setId];
  try {
    await apiFetch(`/leagues/${route.params.id}/sets/${setId}`, {
      method: "PATCH",
      body: JSON.stringify({
        duo1Trainer1: input.d1t1,
        duo1Trainer2: input.d1t2,
        duo2Trainer1: input.d2t1,
        duo2Trainer2: input.d2t2,
      }),
    });
    editingMatchup.value = null;
    await fetchSchedule();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to update matchup";
  }
}

async function deleteLeague() {
  deleting.value = true;
  try {
    await apiFetch(`/leagues/${route.params.id}`, { method: "DELETE" });
    router.push("/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to delete league";
    deleting.value = false;
    confirmDelete.value = false;
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
        <div class="flex gap-2">
          <button
            v-if="isDraft && league.trainers.length >= 4"
            :disabled="generating"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            @click="generateSchedule"
          >
            {{ generating ? "Generating..." : "Generate Schedule" }}
          </button>
          <button
            v-if="canGenerateFinale"
            :disabled="generatingFinale"
            class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            @click="generateFinale"
          >
            {{ generatingFinale ? "Generating..." : "Generate Finale" }}
          </button>
          <button
            v-if="!confirmDelete"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            @click="confirmDelete = true"
          >
            Delete
          </button>
          <template v-else>
            <span class="text-sm text-red-600 self-center">Are you sure?</span>
            <button
              :disabled="deleting"
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              @click="deleteLeague"
            >
              {{ deleting ? "Deleting..." : "Yes, delete" }}
            </button>
            <button
              class="px-4 py-2 border rounded hover:bg-gray-50"
              @click="confirmDelete = false"
            >
              Cancel
            </button>
          </template>
        </div>
      </div>

      <p v-if="generateError" class="text-red-600 text-sm mb-4">{{ generateError }}</p>
      <p v-if="finaleError" class="text-red-600 text-sm mb-4">{{ finaleError }}</p>

      <!-- Standings Board -->
      <section v-if="standings.length > 0" class="mb-8">
        <h2 class="text-lg font-semibold mb-3">Standings</h2>
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-gray-100 text-left">
              <th class="p-2 border">#</th>
              <th class="p-2 border">Trainer</th>
              <th class="p-2 border">Showdown</th>
              <th class="p-2 border text-right">Pts</th>
              <th class="p-2 border text-right">KO Diff</th>
              <th class="p-2 border text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in standings"
              :key="entry.trainerId"
              :class="{ 'bg-yellow-50': entry.isFinalist }"
            >
              <td class="p-2 border font-medium">{{ entry.rank }}</td>
              <td class="p-2 border">{{ entry.trainerName }}</td>
              <td class="p-2 border text-gray-500">{{ entry.showdownName }}</td>
              <td class="p-2 border text-right font-medium">{{ entry.points }}</td>
              <td class="p-2 border text-right" :class="entry.koDifferential > 0 ? 'text-green-600' : entry.koDifferential < 0 ? 'text-red-600' : ''">
                {{ entry.koDifferential > 0 ? "+" : "" }}{{ entry.koDifferential }}
              </td>
              <td class="p-2 border text-center">
                <span v-if="entry.isFinalist" class="text-xs px-2 py-0.5 rounded bg-yellow-200 text-yellow-800">
                  Finalist
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Roster -->
      <section class="mb-8">
        <h2 class="text-lg font-semibold mb-3">
          Roster ({{ league.trainers.length }}/16)
        </h2>

        <div v-if="league.trainers.length === 0" class="text-gray-500 text-sm mb-4">
          No trainers enrolled yet.
        </div>

        <div class="space-y-2 mb-4">
          <div
            v-for="trainer in league.trainers"
            :key="trainer.id"
            class="flex items-center justify-between p-3 bg-white rounded border"
          >
            <div>
              <span class="font-medium">{{ trainer.name }}</span>
              <button
                class="ml-3 text-sm text-blue-500 hover:underline"
                :title="`Copy: ${trainer.showdownName}`"
                @click="copyShowdownName(trainer.showdownName)"
              >
                {{ trainer.showdownName }}
              </button>
            </div>
            <button
              v-if="isDraft"
              class="text-red-500 hover:text-red-700 text-sm"
              @click="removeTrainer(trainer.id)"
            >
              Remove
            </button>
          </div>
        </div>
      </section>

      <!-- Enroll Trainer Form -->
      <section v-if="isDraft">
        <h2 class="text-lg font-semibold mb-3">Enroll Trainer</h2>

        <form class="flex gap-2 items-end" @submit.prevent="enrollTrainer">
          <div class="flex-1">
            <label for="trainer-name" class="block text-sm font-medium mb-1">Name</label>
            <input
              id="trainer-name"
              v-model="trainerName"
              type="text"
              required
              placeholder="Trainer name"
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
            :disabled="enrolling || !trainerName.trim() || !showdownName.trim()"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {{ enrolling ? "..." : "Add" }}
          </button>
        </form>

        <p v-if="enrollError" class="text-red-600 text-sm mt-2">{{ enrollError }}</p>
      </section>

      <!-- Schedule with Result Entry -->
      <section v-if="schedule.length > 0" class="mt-8">
        <h2 class="text-lg font-semibold mb-3">Schedule</h2>

        <div class="space-y-4">
          <div
            v-for="round in schedule"
            :key="round.id"
            class="border rounded bg-white p-4"
          >
            <h3 class="font-medium mb-2">
              {{ round.roundType === 'finale' ? 'Finale' : `Round ${round.roundNumber}` }}
              <span class="text-sm text-gray-500 ml-2">{{ round.status }}</span>
              <span v-if="round.roundType === 'finale'" class="text-sm text-purple-600 ml-2">FFA</span>
            </h3>

            <div class="space-y-3">
              <div
                v-for="set in round.sets"
                :key="set.id"
                class="border rounded p-3"
              >
                <!-- FFA Set Display -->
                <template v-if="set.setType === 'ffa' && set.ffaParticipants">
                  <div class="text-sm mb-2">
                    <span class="font-medium">Free-for-All:</span>
                    {{ set.ffaParticipants.map((p: FfaParticipant) => tName(p.trainerId)).join(', ') }}
                  </div>

                  <!-- Show placements if recorded -->
                  <div v-if="set.ffaParticipants.some((p: FfaParticipant) => p.placement)" class="space-y-1 text-sm">
                    <div
                      v-for="p in [...set.ffaParticipants].sort((a: FfaParticipant, b: FfaParticipant) => (a.placement ?? 99) - (b.placement ?? 99))"
                      :key="p.id"
                      class="flex items-center gap-2"
                    >
                      <span class="font-medium w-12">{{ p.placement === 1 ? '1st' : p.placement === 2 ? '2nd' : p.placement === 3 ? '3rd' : '4th' }}</span>
                      <span>{{ tName(p.trainerId) }}</span>
                      <span class="text-gray-400">+{{ p.placement === 1 ? 6 : p.placement === 2 ? 4 : p.placement === 3 ? 2 : 0 }} pts</span>
                    </div>
                  </div>

                  <!-- Placement entry form -->
                  <div v-else-if="isFinale" class="space-y-2 mt-2">
                    <div
                      v-for="p in set.ffaParticipants"
                      :key="p.id"
                      class="flex items-center gap-2 text-sm"
                    >
                      <span class="w-32">{{ tName(p.trainerId) }}</span>
                      <select
                        v-model.number="placementInputs[p.trainerId]"
                        class="border rounded px-1 py-0.5"
                      >
                        <option :value="undefined">Place</option>
                        <option :value="1">1st (+6)</option>
                        <option :value="2">2nd (+4)</option>
                        <option :value="3">3rd (+2)</option>
                        <option :value="4">4th (+0)</option>
                      </select>
                    </div>
                    <button
                      class="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm disabled:opacity-50"
                      :disabled="submittingPlacements || set.ffaParticipants.some((p: FfaParticipant) => !placementInputs[p.trainerId])"
                      @click="submitPlacements(set.id, set.ffaParticipants)"
                    >
                      {{ submittingPlacements ? 'Saving...' : 'Record Placements' }}
                    </button>

                    <!-- Replay URL for FFA match -->
                    <div v-if="set.matches?.length" class="pt-2 border-t">
                      <div
                        v-for="match in set.matches"
                        :key="match.id"
                        class="flex items-center gap-2 text-xs"
                      >
                        <span class="font-medium">FFA Replay:</span>
                        <template v-if="match.replayUrl">
                          <a :href="match.replayUrl" target="_blank" class="text-blue-500 hover:underline">View</a>
                        </template>
                        <template v-else>
                          <input
                            v-model="replayInputs[match.id]"
                            type="url"
                            placeholder="Paste FFA replay URL..."
                            class="border rounded px-1 py-0.5 flex-1"
                          />
                          <button
                            class="px-2 py-0.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                            :disabled="!replayInputs[match.id] || replaySubmitting[match.id]"
                            @click="submitReplay(set.id, match.id, match.matchNumber)"
                          >
                            {{ replaySubmitting[match.id] ? '...' : 'Parse' }}
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Regular 2HG Set Display -->
                <template v-else>
                  <!-- Matchup Edit Mode -->
                  <div v-if="editingMatchup === set.id && !set.isBye" class="space-y-2 text-xs">
                    <div class="flex items-center gap-2">
                      <label class="text-gray-500 w-14">Duo 1</label>
                      <select v-model="matchupInputs[set.id].d1t1" class="border rounded px-1 py-0.5 flex-1">
                        <option v-for="t in league!.trainers" :key="t.id" :value="t.id">{{ t.name }}</option>
                      </select>
                      <span class="text-gray-400">&amp;</span>
                      <select v-model="matchupInputs[set.id].d1t2" class="border rounded px-1 py-0.5 flex-1">
                        <option v-for="t in league!.trainers" :key="t.id" :value="t.id">{{ t.name }}</option>
                      </select>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-gray-500 w-14">Duo 2</label>
                      <select v-model="matchupInputs[set.id].d2t1" class="border rounded px-1 py-0.5 flex-1">
                        <option v-for="t in league!.trainers" :key="t.id" :value="t.id">{{ t.name }}</option>
                      </select>
                      <span class="text-gray-400">&amp;</span>
                      <select v-model="matchupInputs[set.id].d2t2" class="border rounded px-1 py-0.5 flex-1">
                        <option v-for="t in league!.trainers" :key="t.id" :value="t.id">{{ t.name }}</option>
                      </select>
                    </div>
                    <div class="flex gap-2">
                      <button
                        class="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                        @click="saveMatchup(set.id)"
                      >
                        Save
                      </button>
                      <button
                        class="px-2 py-0.5 border rounded hover:bg-gray-50"
                        @click="editingMatchup = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  <!-- Matchup Display Mode -->
                  <div v-else class="flex items-center gap-2 text-sm">
                    <template v-if="set.isBye">
                      <span class="text-gray-500 italic">
                        BYE:
                        {{ tName(set.duo1Trainer1) }}
                        <template v-if="set.duo1Trainer2">
                          &amp; {{ tName(set.duo1Trainer2) }}
                        </template>
                      </span>
                    </template>
                    <template v-else>
                      <span class="font-medium">
                        {{ tName(set.duo1Trainer1) }} &amp; {{ tName(set.duo1Trainer2) }}
                      </span>
                      <span class="text-gray-400">vs</span>
                      <span class="font-medium">
                        {{ tName(set.duo2Trainer1) }} &amp; {{ tName(set.duo2Trainer2) }}
                      </span>
                      <span v-if="set.result" class="ml-2 text-xs px-2 py-0.5 rounded" :class="{
                        'bg-blue-100 text-blue-700': set.result === 'duo1' || set.result === 'duo2',
                        'bg-gray-100 text-gray-700': set.result === 'draw',
                      }">
                        {{ set.result === 'duo1' ? tName(set.duo1Trainer1) + ' & ' + tName(set.duo1Trainer2) + ' win' : set.result === 'duo2' ? tName(set.duo2Trainer1) + ' & ' + tName(set.duo2Trainer2) + ' win' : 'Draw' }}
                      </span>
                      <button
                        v-if="isActive && !set.isBye"
                        class="ml-auto text-xs text-orange-500 hover:underline"
                        @click="startEditMatchup(set)"
                      >
                        Swap
                      </button>
                      <button
                        v-if="isActive && !set.isBye"
                        class="text-xs text-blue-500 hover:underline"
                        @click="toggleSet(set.id)"
                      >
                        {{ expandedSet === set.id ? "Hide" : "Record" }}
                      </button>
                    </template>
                  </div>

                  <!-- Match Result Entry -->
                  <div v-if="expandedSet === set.id && !set.isBye" class="mt-3 space-y-2">
                    <div
                      v-for="match in (set.matches || []).sort((a: Match, b: Match) => a.matchNumber - b.matchNumber)"
                      :key="match.id"
                      class="text-xs bg-gray-50 p-2 rounded space-y-1"
                    >
                      <div class="flex items-center gap-2">
                        <span class="font-medium w-16">Match {{ match.matchNumber }}</span>
                        <template v-if="match.winner">
                          <span class="text-green-600">
                            {{ match.winner === 'duo1' ? 'Duo 1' : match.winner === 'duo2' ? 'Duo 2' : 'Draw' }}
                          </span>
                          <span class="text-gray-400">KOs: {{ match.duo1Kos }}-{{ match.duo2Kos }}</span>
                          <a
                            v-if="match.replayUrl"
                            :href="match.replayUrl"
                            target="_blank"
                            class="text-blue-500 hover:underline"
                          >Replay</a>
                          <button
                            class="ml-auto text-blue-500 hover:underline"
                            @click="submitMatchResult(match.id, '', 0, 0).then(() => { /* clear handled by refetch */ })"
                          >
                            Edit
                          </button>
                        </template>
                        <template v-else>
                          <div class="flex flex-col gap-1 w-full">
                            <div class="flex items-center gap-2">
                              <label class="text-gray-500 w-14">Winner</label>
                              <select
                                v-model="getMatchInput(match.id).winner"
                                class="border rounded px-1 py-0.5"
                                @change="onWinnerChange(match.id)"
                              >
                                <option value="">--</option>
                                <option value="duo1">Duo 1</option>
                                <option value="duo2">Duo 2</option>
                                <option value="draw">Draw</option>
                              </select>
                            </div>
                            <div class="flex items-center gap-2">
                              <label class="text-gray-500 w-14">D1 KOs</label>
                              <input
                                v-model.number="getMatchInput(match.id).duo1Kos"
                                type="number"
                                min="0"
                                max="6"
                                class="border rounded px-1 py-0.5 w-16"
                              />
                              <label class="text-gray-500 w-14">D2 KOs</label>
                              <input
                                v-model.number="getMatchInput(match.id).duo2Kos"
                                type="number"
                                min="0"
                                max="6"
                                class="border rounded px-1 py-0.5 w-16"
                              />
                              <button
                                class="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                                :disabled="!getMatchInput(match.id).winner"
                                @click="submitMatchResult(match.id, getMatchInput(match.id).winner, getMatchInput(match.id).duo1Kos, getMatchInput(match.id).duo2Kos)"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </template>
                      </div>
                      <div v-if="!match.winner" class="flex items-center gap-2 pt-1">
                        <input
                          v-model="replayInputs[match.id]"
                          type="url"
                          placeholder="Paste replay URL..."
                          class="border rounded px-1 py-0.5 flex-1"
                        />
                        <button
                          class="px-2 py-0.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                          :disabled="!replayInputs[match.id] || replaySubmitting[match.id]"
                          @click="submitReplay(set.id, match.id, match.matchNumber)"
                        >
                          {{ replaySubmitting[match.id] ? '...' : 'Parse' }}
                        </button>
                      </div>
                      <p v-if="replayError[match.id]" class="text-red-600 text-xs">{{ replayError[match.id] }}</p>
                    </div>

                    <!-- Manual Override -->
                    <div class="flex items-center gap-2 text-xs pt-2 border-t">
                      <span class="font-medium text-gray-500">Override set:</span>
                      <button class="px-2 py-0.5 rounded border hover:bg-blue-50" @click="overrideSetResult(set.id, 'duo1')">Duo 1 Win</button>
                      <button class="px-2 py-0.5 rounded border hover:bg-blue-50" @click="overrideSetResult(set.id, 'duo2')">Duo 2 Win</button>
                      <button class="px-2 py-0.5 rounded border hover:bg-gray-50" @click="overrideSetResult(set.id, 'draw')">Draw</button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
