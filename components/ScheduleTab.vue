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
const getPlayerName = (playerId: string): string => {
  const player = playerStore.getPlayer(playerId);
  return player ? player.name : 'Unknown Player';
};

const getPlayerSkill = (playerId: string): number => {
  const player = playerStore.getPlayer(playerId);
  return player ? player.skillLevel : 0;
};

const getSkillLevelColor = (skillLevel: number): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  if (skillLevel >= 4.5) return 'secondary';
  if (skillLevel >= 3.5) return 'success';
  if (skillLevel >= 2.5) return 'warning';
  if (skillLevel >= 1.5) return 'info';
  return 'error';
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const getGameForCourt = (round: readonly Game[], courtNumber: number): Game | undefined => {
  return round.find(game => game.court === courtNumber) as Game | undefined;
};

const exportScheduleData = (): void => {
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
};

const performImport = (): void => {
  try {
    const result = gameStore.importSchedule(importData.value);
    if (result.success) {      toast.add({
        title: 'Import Successful',
        description: result.message,
        color: 'success'
      });
      showImportModal.value = false;
      importData.value = '';
      selectedRound.value = 1;
    } else {      toast.add({
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
};

const clearCurrentSchedule = (): void => {
  gameStore.clearSchedule();
  selectedRound.value = 1;
  toast.add({
    title: 'Schedule Cleared',
    description: 'The current schedule has been cleared.',
    color: 'primary'
  });
};

// Watch for schedule changes and reset round selection
watch(() => gameStore.currentSchedule, (newSchedule) => {
  if (newSchedule && selectedRound.value > newSchedule.rounds.length) {
    selectedRound.value = 1;
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold text-gray-900">Game Schedule</h2>
      <div v-if="gameStore.currentSchedule" class="flex gap-2">
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          @click="exportScheduleData"
        >
          Export JSON
        </UButton>
        <UButton
          variant="outline"
          icon="i-heroicons-arrow-up-tray"
          @click="showImportModal = true"
        >
          Import JSON
        </UButton>        <UButton
          variant="outline"
          color="error"
          icon="i-heroicons-trash"
          @click="clearCurrentSchedule"
        >
          Clear
        </UButton>
      </div>
    </div>    <!-- No Schedule Message -->
    <UCard v-if="!gameStore.currentSchedule">
      <div class="text-center py-12">
        <UIcon name="i-heroicons-calendar-days" class="text-6xl text-gray-300 mb-4" />
        <h3 class="text-xl font-medium text-gray-900 mb-2">No Schedule Generated</h3>
        <p class="text-gray-600 mb-6">
          Go to the "Generate Games" tab to create a new schedule.
        </p>
        <UButton
          to="#games"
          color="primary"
          icon="i-heroicons-cog-6-tooth"
        >
          Generate Schedule
        </UButton>
      </div>
    </UCard>

    <!-- Schedule Display -->
    <div v-if="gameStore.currentSchedule" class="space-y-6">
      <!-- Schedule Info -->
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">Schedule Information</h3>            <UBadge color="success" variant="subtle">
              {{ gameStore.currentSchedule.rounds.length }} Rounds
            </UBadge>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{{ totalGames }}</div>
            <div class="text-sm text-gray-600">Total Games</div>
          </div>          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ gameStore.currentSchedule.options.numberOfCourts }}</div>
            <div class="text-sm text-gray-600">Courts Used</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-yellow-600">{{ averageSkillDifference }}</div>
            <div class="text-sm text-gray-600">Avg Skill Diff</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">{{ restingPlayersPerRound }}</div>
            <div class="text-sm text-gray-600">Resting per Round</div>
          </div>
        </div>        <div v-if="gameStore.currentSchedule.eventLabel" class="mt-4 pt-4 border-t text-center">
          <div class="text-lg font-medium text-gray-900">{{ gameStore.currentSchedule.eventLabel }}</div>
          <div class="text-sm text-gray-600">
            Generated: {{ formatDateTime(gameStore.currentSchedule.generatedAt) }}
          </div>
        </div>
      </UCard>

      <!-- Round Selector -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium">Select Round</h3>
        </template>        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="roundNumber in gameStore.currentSchedule.rounds.length"
            :key="roundNumber"
            :variant="selectedRound === roundNumber ? 'solid' : 'outline'"
            :color="selectedRound === roundNumber ? 'primary' : 'neutral'"
            size="sm"
            @click="selectedRound = roundNumber"
          >
            Round {{ roundNumber }}
          </UButton>
        </div>
      </UCard>

      <!-- Round Details -->
      <UCard v-if="selectedRoundGames">
        <template #header>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">Round {{ selectedRound }} Games</h3>            <UBadge color="primary" variant="subtle">
              {{ selectedRoundGames.length }} Games
            </UBadge>
          </div>
        </template>

        <!-- Games Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="game in selectedRoundGames"
            :key="game.id"
            class="border rounded-lg p-4 bg-white shadow-sm"
          >
            <!-- Court Header -->
            <div class="text-center mb-3">
              <h4 class="text-lg font-semibold text-gray-900">Court {{ game.court }}</h4>
            </div>

            <!-- Team 1 -->
            <div class="mb-2">
              <div class="bg-blue-50 border border-blue-200 rounded p-2">
                <div class="text-sm font-medium text-blue-900 mb-1">Team 1</div>
                <div class="space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ getPlayerName(game.team1[0]) }}</span>
                    <UBadge size="xs" :color="getSkillLevelColor(getPlayerSkill(game.team1[0]))">
                      {{ getPlayerSkill(game.team1[0]) }}
                    </UBadge>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ getPlayerName(game.team1[1]) }}</span>
                    <UBadge size="xs" :color="getSkillLevelColor(getPlayerSkill(game.team1[1]))">
                      {{ getPlayerSkill(game.team1[1]) }}
                    </UBadge>
                  </div>
                </div>
                <div class="text-xs text-blue-700 mt-1 text-center">
                  Total: {{ game.team1SkillLevel.toFixed(1) }}
                </div>
              </div>
            </div>

            <!-- VS -->
            <div class="text-center text-sm font-bold text-gray-500 mb-2">VS</div>

            <!-- Team 2 -->
            <div class="mb-3">
              <div class="bg-red-50 border border-red-200 rounded p-2">
                <div class="text-sm font-medium text-red-900 mb-1">Team 2</div>
                <div class="space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ getPlayerName(game.team2[0]) }}</span>
                    <UBadge size="xs" :color="getSkillLevelColor(getPlayerSkill(game.team2[0]))">
                      {{ getPlayerSkill(game.team2[0]) }}
                    </UBadge>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ getPlayerName(game.team2[1]) }}</span>
                    <UBadge size="xs" :color="getSkillLevelColor(getPlayerSkill(game.team2[1]))">
                      {{ getPlayerSkill(game.team2[1]) }}
                    </UBadge>
                  </div>
                </div>
                <div class="text-xs text-red-700 mt-1 text-center">
                  Total: {{ game.team2SkillLevel.toFixed(1) }}
                </div>
              </div>
            </div>

            <!-- Skill Difference -->
            <div class="text-center">              <UBadge 
                size="xs" 
                :color="game.skillDifference <= 1 ? 'success' : game.skillDifference <= 2 ? 'warning' : 'error'"
              >
                Diff: {{ game.skillDifference.toFixed(1) }}
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Resting Players -->
        <div v-if="selectedRoundResting.length > 0" class="mt-6 pt-6 border-t">
          <h4 class="text-md font-medium text-gray-900 mb-3">Resting Players</h4>
          <div class="flex flex-wrap gap-2">            <UBadge
              v-for="playerId in selectedRoundResting"
              :key="playerId"
              color="warning"
              variant="subtle"
            >
              {{ getPlayerName(playerId) }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <!-- All Rounds Overview -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium">All Rounds Overview</h3>
        </template>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Round</th>                <th
                  v-for="court in gameStore.currentSchedule.options.numberOfCourts"
                  :key="court"
                  class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                >
                  Court {{ court }}
                </th>
                <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Resting</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="(round, roundIndex) in gameStore.currentSchedule.rounds"
                :key="roundIndex"
                class="hover:bg-gray-50"
              >
                <td class="px-3 py-2 text-sm font-medium text-gray-900">
                  Round {{ roundIndex + 1 }}
                </td>
                <td
                  v-for="court in gameStore.currentSchedule.options.numberOfCourts"
                  :key="court"
                  class="px-3 py-2 text-xs text-center"
                >
                  <div v-if="getGameForCourt(round as Game[], court)" class="space-y-1">
                    <div class="text-blue-600">
                      {{ getPlayerName(getGameForCourt(round as Game[], court)!.team1[0]) }},
                      {{ getPlayerName(getGameForCourt(round as Game[], court)!.team1[1]) }}
                    </div>
                    <div class="text-gray-500">vs</div>
                    <div class="text-red-600">
                      {{ getPlayerName(getGameForCourt(round as Game[], court)!.team2[0]) }},
                      {{ getPlayerName(getGameForCourt(round as Game[], court)!.team2[1]) }}
                    </div>
                  </div>
                </td>                <td class="px-3 py-2 text-xs text-center">
                  <div class="space-x-1">
                    <span
                      v-for="playerId in gameStore.currentSchedule.restingPlayers[roundIndex]"
                      :key="playerId"
                      class="inline-block px-1 py-0.5 bg-orange-100 text-orange-800 rounded text-xs"
                    >
                      {{ getPlayerName(playerId) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>    
    
    <!-- Import Modal -->
    <UModal v-model="showImportModal">
      
        <template #header>
          <h3 class="text-lg font-semibold">Import Schedule</h3>
        </template>

        <template #body>
          <UFormField label="JSON Data">
            <UTextarea
              v-model="importData"
              :rows="10"
              placeholder="Paste schedule JSON data here..."
            />
          </UFormField>
        </template>

        <template #footer>
          
            <UButton
              variant="ghost"
              @click="showImportModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              @click="performImport"
            >
              Import
            </UButton>
        </template>
    </UModal>
  </div>
</template>
