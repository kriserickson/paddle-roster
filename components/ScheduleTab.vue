<script setup lang="ts">
import type { Game } from '~/types';

const playerStore = usePlayerStore();
const gameStore = useGameStore();

const toast = useToast();

// Local state
const selectedRound = ref(1);
const showImportModal = ref(false);
const importData = ref('');

// Computed properties
const totalGames = computed(() => {
  if (!gameStore.currentSchedule) return 0;
  return gameStore.currentSchedule.rounds.reduce((sum: number, round) => sum + round.length, 0);
});

const averageSkillDifference = computed(() => {
  if (!gameStore.currentSchedule) return '0.0';
  const allGames = gameStore.currentSchedule.rounds.flat();
  if (allGames.length === 0) return '0.0';
  const total = allGames.reduce((sum: number, game) => sum + game.skillDifference, 0);
  return (total / allGames.length).toFixed(1);
});

const restingPlayersPerRound = computed(() => {
  if (!gameStore.currentSchedule || gameStore.currentSchedule.restingPlayers.length === 0) return 0;
  return gameStore.currentSchedule.restingPlayers[0].length;
});

const selectedRoundGames = computed(() => {
  return gameStore.getGamesForRound(selectedRound.value);
});

const selectedRoundResting = computed(() => {
  return gameStore.getRestingPlayersForRound(selectedRound.value) || [];
});

// Methods
function getPlayerName(playerId: string): string {
  const player = playerStore.getPlayer(playerId);
  return player ? player.name : 'Unknown Player';
}

function getPlayerSkill(playerId: string): number {
  const player = playerStore.getPlayer(playerId);
  return player ? player.skillLevel : 0;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getGameForCourt(round: readonly Game[], courtNumber: number): Game | undefined {
  return round.find(game => game.court === courtNumber) as Game | undefined;
}

function exportScheduleData(): void {
  try {
    const data = gameStore.exportSchedule();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pickleball-schedule-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.add({
        title: 'Export Successful',
        description: 'Schedule has been downloaded as JSON.',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Export failed:', error);
    toast.add({
      title: 'Export Failed',
      description: 'Failed to export schedule.',
      color: 'error'
    });
  }
}

function performImport(): void {
  try {
    const result = gameStore.importSchedule(importData.value);
    if (result.success) {
      toast.add({
        title: 'Import Successful',
        description: result.message,
        color: 'success'
      });
      showImportModal.value = false;
      importData.value = '';
      selectedRound.value = 1;
    } else {
      toast.add({
        title: 'Import Failed',
        description: result.message,
        color: 'error'
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    toast.add({
      title: 'Import Failed',
      description: 'Invalid JSON format.',
      color: 'error'
    });
  }
}

function clearCurrentSchedule(): void {
  gameStore.clearSchedule();
  selectedRound.value = 1;
  toast.add({
    title: 'Schedule Cleared',
    description: 'The current schedule has been cleared.',
    color: 'primary'
  });
}

// Watch for schedule changes and reset round selection
watch(
  () => gameStore.currentSchedule,
  newSchedule => {
    if (newSchedule && selectedRound.value > newSchedule.rounds.length) {
      selectedRound.value = 1;
    }
  }
);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Icon name="mdi:calendar-month" class="text-paddle-teal text-3xl" />
            Game Schedule
          </h2>
          <div v-if="gameStore.currentSchedule" class="flex gap-3">
            <UButton icon="i-heroicons-arrow-down-tray" class="btn-secondary" @click="exportScheduleData">
              Export JSON
            </UButton>
            <UButton icon="i-heroicons-arrow-up-tray" class="btn-secondary" @click="showImportModal = true">
              Import JSON
            </UButton>
            <UButton icon="i-heroicons-trash" class="btn-danger" @click="clearCurrentSchedule"> Clear </UButton>
          </div>
        </div>
      </div>
    </div>
    <!-- No Schedule Message -->
    <div v-if="!gameStore.currentSchedule" class="content-card" data-testid="no-schedule-message">
      <div class="p-16 text-center">
        <Icon name="mdi:calendar-blank" class="text-8xl text-gray-300 mb-6 mx-auto" />
        <h3 class="text-2xl font-bold text-gray-900 mb-3">No Schedule Generated</h3>
        <p class="text-gray-600 mb-8 text-lg">Go to the "Generate Games" tab to create a new schedule.</p>
        <UButton to="#games" class="btn-primary" size="lg" data-testid="generate-schedule-link">
          <Icon name="mdi:cog" class="mr-2" />
          Generate Schedule
        </UButton>
      </div>
    </div>
    <!-- Schedule Display -->
    <div v-if="gameStore.currentSchedule" class="space-y-6" data-testid="schedule-display">
      <!-- Schedule Info -->
      <div class="content-card">
        <div class="content-card-header">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="mdi:information" class="text-paddle-teal" />
              Schedule Information
            </h3>
            <div class="player-skill-badge" data-testid="total-rounds-count">
              {{ gameStore.currentSchedule.rounds.length }} Rounds
            </div>
          </div>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="content-card overflow-hidden">
              <div class="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100">
                <Icon name="mdi:gamepad-variant" class="text-3xl text-blue-600 mb-2 mx-auto" />
                <div class="text-2xl font-bold text-blue-700">{{ totalGames }}</div>
                <div class="text-sm font-medium text-blue-600">Total Games</div>
              </div>
            </div>
            <div class="content-card overflow-hidden">
              <div class="p-4 text-center bg-gradient-to-br from-paddle-teal/10 to-paddle-teal/20">
                <Icon name="mdi:court-sport" class="text-3xl text-paddle-teal mb-2 mx-auto" />
                <div class="text-2xl font-bold text-paddle-teal">
                  {{ gameStore.currentSchedule.options.numberOfCourts }}
                </div>
                <div class="text-sm font-medium text-paddle-teal-dark">Courts Used</div>
              </div>
            </div>
            <div class="content-card overflow-hidden">
              <div class="p-4 text-center bg-gradient-to-br from-amber-50 to-amber-100">
                <Icon name="mdi:balance-scale" class="text-3xl text-amber-600 mb-2 mx-auto" />
                <div class="text-2xl font-bold text-amber-700">{{ averageSkillDifference }}</div>
                <div class="text-sm font-medium text-amber-600">Avg Skill Diff</div>
              </div>
            </div>
            <div class="content-card overflow-hidden">
              <div class="p-4 text-center bg-gradient-to-br from-purple-50 to-purple-100">
                <Icon name="mdi:seat" class="text-3xl text-purple-600 mb-2 mx-auto" />
                <div class="text-2xl font-bold text-purple-700">{{ restingPlayersPerRound }}</div>
                <div class="text-sm font-medium text-purple-600">Resting per Round</div>
              </div>
            </div>
          </div>

          <div v-if="gameStore.currentSchedule.eventLabel" class="mt-6 pt-6 border-t border-gray-200 text-center">
            <div class="text-xl font-bold text-gray-900 mb-2">{{ gameStore.currentSchedule.eventLabel }}</div>
            <div class="text-sm text-gray-600 flex items-center justify-center gap-2">
              <Icon name="mdi:clock-check" class="text-paddle-teal" />
              Generated: {{ formatDateTime(gameStore.currentSchedule.generatedAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Round Selector -->
      <div class="content-card">
        <div class="content-card-header">
          <h3 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="mdi:numeric" class="text-paddle-teal" />
            Select Round
          </h3>
        </div>

        <div class="p-6">
          <div class="flex flex-wrap gap-3">
            <UButton
              v-for="roundNumber in gameStore.currentSchedule.rounds.length"
              :key="roundNumber"
              :class="selectedRound === roundNumber ? 'btn-primary' : 'btn-secondary'"
              size="sm"
              @click="selectedRound = roundNumber"
            >
              Round {{ roundNumber }}
            </UButton>
          </div>
        </div>
      </div>

 <!-- All Rounds Overview -->
      <div class="content-card">
        <div class="content-card-header">
          <h3 class="text-xl font-semibold flex items-center gap-2">
            <Icon name="mdi:table" class="text-paddle-teal" />
            All Rounds Overview
          </h3>
        </div>

        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
              <thead class="bg-gradient-to-r from-paddle-teal to-paddle-teal-light">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Round</th>
                  <th
                    v-for="court in gameStore.currentSchedule.options.numberOfCourts"
                    :key="court"
                    class="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider"
                  >
                    Court {{ court }}
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Resting</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="(round, roundIndex) in gameStore.currentSchedule.rounds"
                  :key="roundIndex"
                  class="hover:bg-paddle-teal/5 transition-colors duration-200"
                  :class="{ 'bg-gray-50': roundIndex % 2 === 1 }"
                >
                  <td class="px-4 py-3 text-sm font-bold text-gray-900 bg-gray-50">
                    <div class="flex items-center gap-2">
                      <Icon name="mdi:numeric" class="text-paddle-teal" />
                      Round {{ roundIndex + 1 }}
                    </div>
                  </td>
                  <td
                    v-for="court in gameStore.currentSchedule.options.numberOfCourts"
                    :key="court"
                    class="px-4 py-3 text-xs text-center"
                  >
                    <div v-if="getGameForCourt(round as Game[], court)" class="space-y-2">
                      <div class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {{ getPlayerName(getGameForCourt(round as Game[], court)!.team1[0]) }},
                        {{ getPlayerName(getGameForCourt(round as Game[], court)!.team1[1]) }}
                      </div>
                      <div class="text-paddle-teal font-bold text-xs">vs</div>
                      <div class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                        {{ getPlayerName(getGameForCourt(round as Game[], court)!.team2[0]) }},
                        {{ getPlayerName(getGameForCourt(round as Game[], court)!.team2[1]) }}
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-xs text-center">
                    <div class="flex flex-wrap gap-1 justify-center">
                      <span
                        v-for="playerId in gameStore.currentSchedule.restingPlayers[roundIndex]"
                        :key="playerId"
                        class="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium"
                      >
                        {{ getPlayerName(playerId) }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Round Details -->
      <div v-if="selectedRoundGames" class="content-card">
        <div class="content-card-header">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-semibold flex items-center gap-2">
              <Icon name="mdi:gamepad-variant" class="text-paddle-teal" />
              Round {{ selectedRound }} Games
            </h3>
            <div class="player-skill-badge">{{ selectedRoundGames.length }} Games</div>
          </div>
        </div>

        <div class="p-6">
          <!-- Games Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div v-for="game in selectedRoundGames" :key="game.id" class="game-card p-6">
              <!-- Court Header -->
              <div class="text-center mb-4">
                <div class="court-badge text-sm">Court {{ game.court }}</div>
              </div>

              <!-- Team 1 -->
              <div class="mb-3">
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-3">
                  <div class="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <Icon name="mdi:account-group" class="text-blue-600" />
                    Team 1
                  </div>
                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium">{{ getPlayerName(game.team1[0]) }}</span>
                      <div class="player-skill-badge text-xs">
                        {{ getPlayerSkill(game.team1[0]) }}
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium">{{ getPlayerName(game.team1[1]) }}</span>
                      <div class="player-skill-badge text-xs">
                        {{ getPlayerSkill(game.team1[1]) }}
                      </div>
                    </div>
                  </div>
                  <div class="text-xs font-bold text-blue-700 mt-2 text-center bg-blue-200 rounded px-2 py-1">
                    Total: {{ game.team1SkillLevel.toFixed(1) }}
                  </div>
                </div>
              </div>

              <!-- VS -->
              <div class="text-center text-lg font-bold text-paddle-teal mb-3 flex items-center justify-center gap-2">
                <Icon name="mdi:sword-cross" class="text-paddle-red" />
                VS
                <Icon name="mdi:sword-cross" class="text-paddle-red" />
              </div>

              <!-- Team 2 -->
              <div class="mb-4">
                <div class="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-3">
                  <div class="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                    <Icon name="mdi:account-group" class="text-red-600" />
                    Team 2
                  </div>
                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium">{{ getPlayerName(game.team2[0]) }}</span>
                      <div class="player-skill-badge text-xs">
                        {{ getPlayerSkill(game.team2[0]) }}
                      </div>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-medium">{{ getPlayerName(game.team2[1]) }}</span>
                      <div class="player-skill-badge text-xs">
                        {{ getPlayerSkill(game.team2[1]) }}
                      </div>
                    </div>
                  </div>
                  <div class="text-xs font-bold text-red-700 mt-2 text-center bg-red-200 rounded px-2 py-1">
                    Total: {{ game.team2SkillLevel.toFixed(1) }}
                  </div>
                </div>
              </div>

              <!-- Skill Difference -->
              <div class="text-center">
                <div
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                  :class="{
                    'bg-emerald-100 text-emerald-800': game.skillDifference <= 1,
                    'bg-amber-100 text-amber-800': game.skillDifference > 1 && game.skillDifference <= 2,
                    'bg-red-100 text-red-800': game.skillDifference > 2
                  }"
                >
                  <Icon name="mdi:balance-scale" />
                  Diff: {{ game.skillDifference.toFixed(1) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Resting Players -->
          <div v-if="selectedRoundResting.length > 0" class="rest-players mt-6">
            <h4 class="rest-title flex items-center gap-2">
              <Icon name="mdi:seat" class="text-amber-600" />
              Resting Players
            </h4>
            <div class="flex flex-wrap gap-3">
              <div
                v-for="playerId in selectedRoundResting"
                :key="playerId"
                class="flex items-center gap-2 bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-sm font-medium"
              >
                <Icon name="mdi:account-clock" />
                {{ getPlayerName(playerId) }}
              </div>
            </div>
          </div>
        </div>
      </div>
     
    </div>
    <!-- Import Modal -->
    <UModal v-model:open="showImportModal" title="Import Schedule">
      <template #body>
        <div class="space-y-6">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="mdi:upload" class="text-paddle-teal text-xl" />
            <p class="text-sm text-gray-600">Paste schedule JSON data to import.</p>
          </div>

          <UFormField label="JSON Data">
            <UTextarea
              v-model="importData"
              :rows="10"
              placeholder="Paste schedule JSON data here..."
              class="form-input font-mono text-sm"
            />
          </UFormField>

          <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <UButton variant="ghost" class="btn-secondary" @click="showImportModal = false"> Cancel </UButton>
            <UButton class="btn-primary" @click="performImport"> Import </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
