<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiFetch } from "../api/client";

interface Player {
  id: string;
  name: string;
  showdownName: string;
}

interface Game {
  id: string;
  gameNumber: number;
  winner: string | null;
  team1Kos: number;
  team2Kos: number;
  replayUrl: string | null;
}

interface FfaParticipant {
  id: string;
  playerId: string;
  placement: number | null;
}

interface Match {
  id: string;
  matchType: string;
  team1Player1: string | null;
  team1Player2: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  isBye: boolean;
  result: string | null;
  games: Game[];
  ffaParticipants?: FfaParticipant[];
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

interface StandingEntry {
  playerId: string;
  playerName: string;
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

const playerName = ref("");
const showdownName = ref("");
const enrolling = ref(false);
const enrollError = ref<string | null>(null);
const generating = ref(false);
const generateError = ref<string | null>(null);

const expandedMatch = ref<string | null>(null);
const gameInputs = ref<Record<string, { winner: string; team1Kos: number; team2Kos: number }>>({});
const replayInputs = ref<Record<string, string>>({});
const replaySubmitting = ref<Record<string, boolean>>({});
const replayError = ref<Record<string, string>>({});
const generatingFinale = ref(false);
const finaleError = ref<string | null>(null);
const deleting = ref(false);
const confirmDelete = ref(false);
const placementInputs = ref<Record<string, number>>({});
const submittingPlacements = ref(false);

function getGameInput(gameId: string) {
  if (!gameInputs.value[gameId]) {
    gameInputs.value[gameId] = { winner: "", team1Kos: 0, team2Kos: 0 };
  }
  return gameInputs.value[gameId];
}

const isDraft = computed(() => league.value?.status === "draft");
const isActive = computed(
  () => league.value?.status === "active" || league.value?.status === "finale",
);
const playerMap = computed(() => {
  const map = new Map<string, string>();
  if (league.value) {
    for (const p of league.value.players) {
      map.set(p.id, p.name);
    }
  }
  return map;
});

const canGenerateFinale = computed(() => {
  if (league.value?.status !== "active") return false;
  const regularRounds = schedule.value.filter((r) => r.roundType === "regular");
  if (regularRounds.length === 0) return false;
  return regularRounds.every((r) =>
    r.matches.every((m) => m.isBye || m.result !== null),
  );
});

const isFinale = computed(() => league.value?.status === "finale");

function pName(id: string | null): string {
  if (!id) return "";
  return playerMap.value.get(id) ?? id;
}

function toggleMatch(matchId: string) {
  expandedMatch.value = expandedMatch.value === matchId ? null : matchId;
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
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    generateError.value = e instanceof Error ? e.message : "Failed to generate schedule";
  } finally {
    generating.value = false;
  }
}

async function submitGameResult(gameId: string, winner: string, team1Kos: number, team2Kos: number) {
  try {
    await apiFetch(`/leagues/${route.params.id}/games/${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ winner, team1Kos, team2Kos }),
    });
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to submit game result";
  }
}

async function submitReplay(matchId: string, gameId: string, gameNumber: number) {
  const url = replayInputs.value[gameId];
  if (!url) return;
  replaySubmitting.value[gameId] = true;
  replayError.value[gameId] = "";
  try {
    await apiFetch(`/leagues/${route.params.id}/matches/${matchId}/games`, {
      method: "POST",
      body: JSON.stringify({ replayUrl: url, gameNumber }),
    });
    replayInputs.value[gameId] = "";
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    replayError.value[gameId] = e instanceof Error ? e.message : "Failed to submit replay";
  } finally {
    replaySubmitting.value[gameId] = false;
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

async function submitPlacements(matchId: string, participants: FfaParticipant[]) {
  submittingPlacements.value = true;
  try {
    const placements = participants.map((p) => ({
      playerId: p.playerId,
      placement: placementInputs.value[p.playerId],
    }));
    await apiFetch(`/leagues/${route.params.id}/matches/${matchId}/placements`, {
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

async function overrideMatchResult(matchId: string, result: string) {
  try {
    await apiFetch(`/leagues/${route.params.id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ result }),
    });
    await Promise.all([fetchSchedule(), fetchStandings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to override match result";
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
            v-if="isDraft && league.players.length >= 4"
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
              <th class="p-2 border">Player</th>
              <th class="p-2 border">Showdown</th>
              <th class="p-2 border text-right">Pts</th>
              <th class="p-2 border text-right">KO Diff</th>
              <th class="p-2 border text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in standings"
              :key="entry.playerId"
              :class="{ 'bg-yellow-50': entry.isFinalist }"
            >
              <td class="p-2 border font-medium">{{ entry.rank }}</td>
              <td class="p-2 border">{{ entry.playerName }}</td>
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

      <!-- Enroll Player Form -->
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
                v-for="match in round.matches"
                :key="match.id"
                class="border rounded p-3"
              >
                <!-- FFA Match Display -->
                <template v-if="match.matchType === 'ffa' && match.ffaParticipants">
                  <div class="text-sm mb-2">
                    <span class="font-medium">Free-for-All:</span>
                    {{ match.ffaParticipants.map((p: FfaParticipant) => pName(p.playerId)).join(', ') }}
                  </div>

                  <!-- Show placements if recorded -->
                  <div v-if="match.ffaParticipants.some((p: FfaParticipant) => p.placement)" class="space-y-1 text-sm">
                    <div
                      v-for="p in [...match.ffaParticipants].sort((a: FfaParticipant, b: FfaParticipant) => (a.placement ?? 99) - (b.placement ?? 99))"
                      :key="p.id"
                      class="flex items-center gap-2"
                    >
                      <span class="font-medium w-12">{{ p.placement === 1 ? '1st' : p.placement === 2 ? '2nd' : p.placement === 3 ? '3rd' : '4th' }}</span>
                      <span>{{ pName(p.playerId) }}</span>
                      <span class="text-gray-400">+{{ p.placement === 1 ? 6 : p.placement === 2 ? 4 : p.placement === 3 ? 2 : 0 }} pts</span>
                    </div>
                  </div>

                  <!-- Placement entry form -->
                  <div v-else-if="isFinale" class="space-y-2 mt-2">
                    <div
                      v-for="p in match.ffaParticipants"
                      :key="p.id"
                      class="flex items-center gap-2 text-sm"
                    >
                      <span class="w-32">{{ pName(p.playerId) }}</span>
                      <select
                        v-model.number="placementInputs[p.playerId]"
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
                      :disabled="submittingPlacements || match.ffaParticipants.some((p: FfaParticipant) => !placementInputs[p.playerId])"
                      @click="submitPlacements(match.id, match.ffaParticipants)"
                    >
                      {{ submittingPlacements ? 'Saving...' : 'Record Placements' }}
                    </button>

                    <!-- Replay URL for FFA game -->
                    <div v-if="match.games?.length" class="pt-2 border-t">
                      <div
                        v-for="game in match.games"
                        :key="game.id"
                        class="flex items-center gap-2 text-xs"
                      >
                        <span class="font-medium">FFA Replay:</span>
                        <template v-if="game.replayUrl">
                          <a :href="game.replayUrl" target="_blank" class="text-blue-500 hover:underline">View</a>
                        </template>
                        <template v-else>
                          <input
                            v-model="replayInputs[game.id]"
                            type="url"
                            placeholder="Paste FFA replay URL..."
                            class="border rounded px-1 py-0.5 flex-1"
                          />
                          <button
                            class="px-2 py-0.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                            :disabled="!replayInputs[game.id] || replaySubmitting[game.id]"
                            @click="submitReplay(match.id, game.id, game.gameNumber)"
                          >
                            {{ replaySubmitting[game.id] ? '...' : 'Parse' }}
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Regular 2HG Match Display -->
                <template v-else>
                  <div class="flex items-center gap-2 text-sm">
                    <template v-if="match.isBye">
                      <span class="text-gray-500 italic">
                        BYE:
                        {{ pName(match.team1Player1) }}
                        <template v-if="match.team1Player2">
                          &amp; {{ pName(match.team1Player2) }}
                        </template>
                      </span>
                    </template>
                    <template v-else>
                      <span class="font-medium">
                        {{ pName(match.team1Player1) }} &amp; {{ pName(match.team1Player2) }}
                      </span>
                      <span class="text-gray-400">vs</span>
                      <span class="font-medium">
                        {{ pName(match.team2Player1) }} &amp; {{ pName(match.team2Player2) }}
                      </span>
                      <span v-if="match.result" class="ml-2 text-xs px-2 py-0.5 rounded" :class="{
                        'bg-blue-100 text-blue-700': match.result === 'team1' || match.result === 'team2',
                        'bg-gray-100 text-gray-700': match.result === 'draw',
                      }">
                        {{ match.result === 'team1' ? pName(match.team1Player1) + ' & ' + pName(match.team1Player2) + ' win' : match.result === 'team2' ? pName(match.team2Player1) + ' & ' + pName(match.team2Player2) + ' win' : 'Draw' }}
                      </span>
                      <button
                        v-if="isActive && !match.isBye"
                        class="ml-auto text-xs text-blue-500 hover:underline"
                        @click="toggleMatch(match.id)"
                      >
                        {{ expandedMatch === match.id ? "Hide" : "Record" }}
                      </button>
                    </template>
                  </div>

                  <!-- Game Result Entry -->
                  <div v-if="expandedMatch === match.id && !match.isBye" class="mt-3 space-y-2">
                    <div
                      v-for="game in (match.games || []).sort((a: Game, b: Game) => a.gameNumber - b.gameNumber)"
                      :key="game.id"
                      class="text-xs bg-gray-50 p-2 rounded space-y-1"
                    >
                      <div class="flex items-center gap-2">
                        <span class="font-medium w-16">Game {{ game.gameNumber }}</span>
                        <template v-if="game.winner">
                          <span class="text-green-600">
                            {{ game.winner === 'team1' ? 'Team 1' : game.winner === 'team2' ? 'Team 2' : 'Draw' }}
                          </span>
                          <span class="text-gray-400">KOs: {{ game.team1Kos }}-{{ game.team2Kos }}</span>
                          <a
                            v-if="game.replayUrl"
                            :href="game.replayUrl"
                            target="_blank"
                            class="text-blue-500 hover:underline"
                          >Replay</a>
                          <button
                            class="ml-auto text-blue-500 hover:underline"
                            @click="submitGameResult(game.id, '', 0, 0).then(() => { /* clear handled by refetch */ })"
                          >
                            Edit
                          </button>
                        </template>
                        <template v-else>
                          <select
                            v-model="getGameInput(game.id).winner"
                            class="border rounded px-1 py-0.5"
                          >
                            <option value="">Winner</option>
                            <option value="team1">Team 1</option>
                            <option value="team2">Team 2</option>
                            <option value="draw">Draw</option>
                          </select>
                          <input
                            v-model.number="getGameInput(game.id).team1Kos"
                            type="number"
                            min="0"
                            max="6"
                            placeholder="T1 KOs"
                            class="border rounded px-1 py-0.5 w-16"
                          />
                          <input
                            v-model.number="getGameInput(game.id).team2Kos"
                            type="number"
                            min="0"
                            max="6"
                            placeholder="T2 KOs"
                            class="border rounded px-1 py-0.5 w-16"
                          />
                          <button
                            class="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                            :disabled="!getGameInput(game.id).winner"
                            @click="submitGameResult(game.id, getGameInput(game.id).winner, getGameInput(game.id).team1Kos, getGameInput(game.id).team2Kos)"
                          >
                            Save
                          </button>
                        </template>
                      </div>
                      <div v-if="!game.winner" class="flex items-center gap-2 pt-1">
                        <input
                          v-model="replayInputs[game.id]"
                          type="url"
                          placeholder="Paste replay URL..."
                          class="border rounded px-1 py-0.5 flex-1"
                        />
                        <button
                          class="px-2 py-0.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                          :disabled="!replayInputs[game.id] || replaySubmitting[game.id]"
                          @click="submitReplay(match.id, game.id, game.gameNumber)"
                        >
                          {{ replaySubmitting[game.id] ? '...' : 'Parse' }}
                        </button>
                      </div>
                      <p v-if="replayError[game.id]" class="text-red-600 text-xs">{{ replayError[game.id] }}</p>
                    </div>

                    <!-- Manual Override -->
                    <div class="flex items-center gap-2 text-xs pt-2 border-t">
                      <span class="font-medium text-gray-500">Override match:</span>
                      <button class="px-2 py-0.5 rounded border hover:bg-blue-50" @click="overrideMatchResult(match.id, 'team1')">Team 1 Win</button>
                      <button class="px-2 py-0.5 rounded border hover:bg-blue-50" @click="overrideMatchResult(match.id, 'team2')">Team 2 Win</button>
                      <button class="px-2 py-0.5 rounded border hover:bg-gray-50" @click="overrideMatchResult(match.id, 'draw')">Draw</button>
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
