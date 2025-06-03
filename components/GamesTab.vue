<script setup lang="ts">
import type { MatchingOptions, Player } from '~/types';

const { players } = usePlayerManager();
const {
  selectedPlayers: selectedPlayersFromSelection,
  togglePlayerSelection,
  selectAllPlayers,
  deselectAllPlayers,
  isPlayerSelected,
  getPlayer
} = usePlayerSelection();
const gameStore = useGameStore();

const toast = useToast();

// Local reactive state
const eventLabel = ref('');
const matchingOptions = ref<MatchingOptions>({ ...gameStore.matchingOptions });

// Player filtering state
const playerSearchQuery = ref('');
const skillLevelFilter = ref('all');

// Watch for changes and update the game generator
watch(
  matchingOptions,
  newOptions => {
    gameStore.updateOptions(newOptions);
  },
  { deep: true }
);

// Filter options
const skillLevelFilterOptions = [
  { label: 'All Skill Levels', value: 'all' },
  { label: 'Beginner (1.0-2.75)', value: 'beginner' },
  { label: 'Intermediate (3-3.5)', value: 'intermediate' },
  { label: 'Advanced (3.6-5.0)', value: 'advanced' }
];

// Computed properties
const selectedPlayers = computed(() => selectedPlayersFromSelection.value);

const filteredPlayers = computed(() => {
  let filtered = players.value;

  // Apply search filter
  if (playerSearchQuery.value) {
    const query = playerSearchQuery.value.toLowerCase();
    filtered = filtered.filter(player => player.name.toLowerCase().includes(query));
  }

  // Apply skill level filter
  if (skillLevelFilter.value !== 'all') {
    filtered = filtered.filter(player => {
      const skill = player.skillLevel;
      switch (skillLevelFilter.value) {
        case 'beginner':
          return skill >= 1.0 && skill <= 2.0;
        case 'intermediate':
          return skill > 2.0 && skill <= 3.5;
        case 'advanced':
          return skill > 3.5 && skill <= 5.0;
        default:
          return true;
      }
    });
  }

  return filtered;
});

const scheduleStats = computed(() => gameStore.scheduleStats);

const playersPerRound = computed(() => {
  return matchingOptions.value.numberOfCourts * 4;
});

const restingPerRound = computed(() => {
  return Math.max(0, selectedPlayers.value.length - playersPerRound.value);
});

const averageSkillLevel = computed(() => {
  if (selectedPlayers.value.length === 0) return '0.0';
  const total = selectedPlayers.value.reduce((sum: number, player: Player) => sum + player.skillLevel, 0);
  return (total / selectedPlayers.value.length).toFixed(1);
});

const validationResult = computed(() => gameStore.validateOptions());

const canGenerate = computed(() => validationResult.value.valid);

const validationErrors = computed(() => validationResult.value.errors);

// Methods
function selectFilteredPlayers(): void {
  filteredPlayers.value.forEach(player => {
    if (!isPlayerSelected(player.id)) {
      togglePlayerSelection(player.id);
    }
  });
}

function deselectFilteredPlayers(): void {
  filteredPlayers.value.forEach(player => {
    if (isPlayerSelected(player.id)) {
      togglePlayerSelection(player.id);
    }
  });
}

function clearAllFilters(): void {
  playerSearchQuery.value = '';
  skillLevelFilter.value = 'all';
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function generateGames(): Promise<void> {
  try {
    const schedule = await gameStore.generateSchedule(eventLabel.value);
    if (schedule) {
      toast.add({
        title: 'Schedule Generated',
        description: `Successfully created ${schedule.rounds.length} rounds with ${schedule.rounds.reduce((sum, round) => sum + round.length, 0)} total games.`,
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Generation error:', error);
    toast.add({
      title: 'Generation Failed',
      description: error instanceof Error ? error.message : 'Failed to generate schedule',
      color: 'error'
    });
  }
}

async function regenerateGames(): Promise<void> {
  try {
    const schedule = await gameStore.regenerateSchedule();
    if (schedule) {
      toast.add({
        title: 'Schedule Regenerated',
        description: 'Successfully created a new schedule with the same settings.',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Regeneration error:', error);
    toast.add({
      title: 'Regeneration Failed',
      description: error instanceof Error ? error.message : 'Failed to regenerate schedule',
      color: 'error'
    });
  }
}

function resetToDefaults(): void {
  gameStore.resetOptions();
  matchingOptions.value = { ...gameStore.matchingOptions };
  toast.add({
    title: 'Options Reset',
    description: 'All options have been reset to default values.',
    color: 'info'
  });
}

// Initialize with current options
onMounted(() => {
  matchingOptions.value = { ...gameStore.matchingOptions };
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">Game Generation</h2>
          <div class="flex gap-3">
            <UButton
              :disabled="!canGenerate || gameStore.isGenerating"
              :loading="gameStore.isGenerating"
              size="lg"
              class="btn-primary"
              data-testid="generate-games-button"
              @click="generateGames"
            >
              <UIcon name="i-heroicons-play" class="mr-2" />
              Generate Schedule
            </UButton>
            <UButton
              v-if="gameStore.currentSchedule"
              :disabled="gameStore.isGenerating"
              class="btn-secondary"
              data-testid="regenerate-games-button"
              @click="regenerateGames"
            >
              <UIcon name="i-heroicons-arrow-path" class="mr-2" />
              Regenerate
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Validation Messages -->
    <div v-if="validationErrors.length > 0" class="alert-error p-4 rounded-xl flex items-start gap-3">
      <Icon name="mdi:alert-circle" class="text-xl text-paddle-red mt-1" />
      <div>
        <p class="font-semibold">Cannot Generate Games</p>
        <p class="text-sm">{{ validationErrors.join(', ') }}</p>
      </div>
    </div>

    <!-- Configuration -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Game Settings -->
      <div class="content-card">
        <div class="content-card-header">
          <h3 class="text-xl font-semibold flex items-center gap-2">
            <Icon name="mdi:cog" class="text-paddle-teal" />
            Game Settings
          </h3>
        </div>

        <div class="p-6 space-y-6">
          <!-- Event Label -->
          <UFormField label="Event Label" help="Optional label for the schedule (e.g., 'Tuesday May 28th')">
            <UInput
              v-model="eventLabel"
              placeholder="e.g., John Henry Secondary School Tuesday May 9th"
              class="form-input w-full"
            />
          </UFormField>

          <!-- Number of Courts -->
          <UFormField label="Number of Courts" help="How many courts are available for games">
            <USlider v-model="matchingOptions.numberOfCourts" :min="1" :max="5" :step="1" class="mb-3" />
            <div class="text-center">
              <span class="player-skill-badge"> {{ matchingOptions.numberOfCourts }} courts </span>
            </div>
          </UFormField>

          <!-- Number of Rounds -->
          <UFormField label="Number of Rounds" help="How many rounds to generate (typically 7-9)">
            <USlider v-model="matchingOptions.numberOfRounds" :min="1" :max="15" :step="1" class="mb-3" />
            <div class="text-center">
              <span class="player-skill-badge"> {{ matchingOptions.numberOfRounds }} rounds </span>
            </div>
          </UFormField>

          <!-- Max Skill Difference -->
          <UFormField label="Maximum Skill Difference" help="Maximum allowed skill difference between teams">
            <USlider v-model="matchingOptions.maxSkillDifference" :min="0.5" :max="4.0" :step="0.25" class="mb-3" />
            <div class="text-center">
              <span class="player-skill-badge">
                {{ matchingOptions.maxSkillDifference }}
              </span>
            </div>
          </UFormField>
        </div>
      </div>

      <!-- Algorithm Options -->
      <div class="content-card">
        <div class="content-card-header">
          <h3 class="text-xl font-semibold flex items-center gap-2">
            <Icon name="mdi:tune" class="text-paddle-teal" />
            Algorithm Options
          </h3>
        </div>

        <div class="p-6 space-y-6">
          <UFormField label="Balance Skill Levels" help="Attempt to create balanced teams by skill level">
            <USwitch
              v-model="matchingOptions.balanceSkillLevels"
              :label="matchingOptions.balanceSkillLevels ? 'Enabled' : 'Disabled'"
              class="text-paddle-teal"
            />
          </UFormField>

          <UFormField
            label="Respect Partner Preferences"
            help="Try to pair players with their preferred partners in at least one game"
          >
            <USwitch
              v-model="matchingOptions.respectPartnerPreferences"
              :label="matchingOptions.respectPartnerPreferences ? 'Enabled' : 'Disabled'"
              class="text-paddle-teal"
            />
          </UFormField>

          <UFormField label="Distribute Rest Equally" help="Ensure all players get equal rest periods">
            <USwitch
              v-model="matchingOptions.distributeRestEqually"
              :label="matchingOptions.distributeRestEqually ? 'Enabled' : 'Disabled'"
              class="text-paddle-teal"
            />
          </UFormField>

          <!-- Reset Options -->
          <div class="pt-6 border-t border-gray-200">
            <UButton class="btn-secondary w-full" @click="resetToDefaults">
              <Icon name="mdi:refresh" class="mr-2" />
              Reset to Defaults
            </UButton>
          </div>
        </div>
      </div>
    </div>
    <!-- Player Selection Interface -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-semibold flex items-center gap-2">
            <Icon name="mdi:account-check" class="text-paddle-teal" />
            Player Selection
          </h3>
          <div class="flex gap-2">
            <UButton variant="ghost" size="sm" class="btn-secondary" @click="selectAllPlayers()"> Select All </UButton>
            <UButton variant="ghost" size="sm" class="btn-secondary" @click="deselectAllPlayers()">
              Deselect All
            </UButton>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- Filter Controls -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <!-- Search -->
          <div class="md:col-span-3">
            <UFormField label="Search Players">
              <UInput
                v-model="playerSearchQuery"
                icon="i-heroicons-magnifying-glass"
                placeholder="Search by name..."
                class="form-input w-full"
              />
            </UFormField>
          </div>

          <!-- Skill Level Filter -->
          <div>
            <UFormField label="Skill Level">
              <USelect v-model="skillLevelFilter" :items="skillLevelFilterOptions" class="form-input" />
            </UFormField>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <Icon name="mdi:information" class="text-paddle-teal" />
            <span>
              Showing {{ filteredPlayers.length }} of {{ players.length }} players. You need at least
              {{ matchingOptions.numberOfCourts * 4 }} players for {{ matchingOptions.numberOfCourts }} court(s).
            </span>
          </div>

          <div class="flex gap-2">
            <UButton
              variant="ghost"
              size="sm"
              :disabled="filteredPlayers.length === 0"
              class="btn-secondary"
              @click="selectFilteredPlayers()"
            >
              Add Filtered
            </UButton>
            <UButton
              variant="ghost"
              size="sm"
              :disabled="filteredPlayers.length === 0"
              class="btn-secondary"
              @click="deselectFilteredPlayers()"
            >
              Remove Filtered
            </UButton>
            <UButton variant="ghost" size="sm" class="btn-secondary" @click="clearAllFilters()">
              Clear Filters
            </UButton>
          </div>
        </div>

        <div v-if="players.length === 0" class="text-center py-8 text-gray-500">
          <Icon name="mdi:account-plus" class="text-4xl text-gray-300 mb-3 mx-auto" />
          <p class="text-lg mb-2">No players available</p>
          <p class="text-sm">Add some players first in the Players tab.</p>
        </div>

        <div v-else-if="filteredPlayers.length === 0" class="text-center py-8 text-gray-500">
          <Icon name="mdi:filter-off" class="text-4xl text-gray-300 mb-3 mx-auto" />
          <p class="text-lg mb-2">No players match your filters</p>
          <p class="text-sm">Try adjusting your search criteria or clearing filters.</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="player in filteredPlayers"
            :key="player.id"
            :class="[
              'player-selection-card p-3 rounded-lg border-2 transition-all cursor-pointer',
              isPlayerSelected(player.id)
                ? 'border-paddle-teal bg-paddle-teal/5'
                : 'border-gray-200 hover:border-paddle-teal/50'
            ]"
            @click="togglePlayerSelection(player.id)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UCheckbox
                  :checked="isPlayerSelected(player.id)"
                  class="pointer-events-none"
                  @change="togglePlayerSelection(player.id)"
                />
                <div
                  class="w-8 h-8 rounded-full bg-gradient-to-br from-paddle-teal to-paddle-teal-light flex items-center justify-center text-white font-bold text-xs"
                >
                  {{ player.name.charAt(0).toUpperCase() }}
                </div>
                <span class="text-sm font-medium">{{ player.name }}</span>
              </div>
              <div class="player-skill-badge text-xs">
                {{ player.skillLevel }}
              </div>
            </div>
            <div v-if="player.partnerId" class="mt-2 text-xs text-gray-600 flex items-center gap-1">
              <Icon name="mdi:account-heart" class="text-paddle-red" />
              Partner: {{ getPlayer(player.partnerId)?.name || 'Unknown' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Player Summary -->
    <div class="content-card">
      <div class="content-card-header">
        <h3 class="text-xl font-semibold flex items-center gap-2">
          <Icon name="mdi:account-group" class="text-paddle-teal" />
          Selected Players Summary
        </h3>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100">
              <Icon name="mdi:account-multiple" class="text-3xl text-blue-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-blue-700">{{ selectedPlayers.length }}</div>
              <div class="text-sm font-medium text-blue-600">Selected Players</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-paddle-teal/10 to-paddle-teal/20">
              <Icon name="mdi:account-convert" class="text-3xl text-paddle-teal mb-2 mx-auto" />
              <div class="text-2xl font-bold text-paddle-teal">{{ playersPerRound }}</div>
              <div class="text-sm font-medium text-paddle-teal-dark">Players per Round</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-amber-50 to-amber-100">
              <Icon name="mdi:seat" class="text-3xl text-amber-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-amber-700">{{ restingPerRound }}</div>
              <div class="text-sm font-medium text-amber-600">Resting per Round</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-purple-50 to-purple-100">
              <Icon name="mdi:star" class="text-3xl text-purple-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-purple-700">{{ averageSkillLevel }}</div>
              <div class="text-sm font-medium text-purple-600">Avg Skill Level</div>
            </div>
          </div>
        </div>
        <!-- Player List -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div v-for="player in selectedPlayers" :key="player.id" class="player-card p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-full bg-gradient-to-br from-paddle-teal to-paddle-teal-light flex items-center justify-center text-white font-bold text-xs"
                >
                  {{ player.name.charAt(0).toUpperCase() }}
                </div>
                <span class="text-sm font-medium">{{ player.name }}</span>
              </div>
              <div class="player-skill-badge text-xs">
                {{ player.skillLevel }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectedPlayers.length === 0" class="text-center py-12 text-gray-500">
          <Icon name="mdi:account-off" class="text-6xl text-gray-300 mb-4 mx-auto" />
          <p class="text-lg">No selected players found</p>
          <p class="text-sm">Select some players first to generate games.</p>
        </div>
      </div>
    </div>

    <!-- Generation Progress -->
    <div v-if="gameStore.isGenerating" class="content-card">
      <div class="p-12 text-center">
        <Icon name="mdi:cog" class="text-6xl text-paddle-teal animate-spin mb-6 mx-auto" />
        <h3 class="text-2xl font-bold mb-3 text-gray-900">Generating Schedule...</h3>
        <p class="text-gray-600 text-lg">Creating balanced games across {{ matchingOptions.numberOfRounds }} rounds</p>
        <div class="mt-6 max-w-md mx-auto bg-gray-200 rounded-full h-2">
          <div
            class="bg-gradient-to-r from-paddle-teal to-paddle-teal-light h-2 rounded-full animate-pulse"
            style="width: 60%"
          />
        </div>
      </div>
    </div>

    <!-- Generation Results -->
    <div v-if="gameStore.currentSchedule && scheduleStats" class="content-card">
      <div class="content-card-header">
        <h3 class="text-xl font-semibold flex items-center gap-2">
          <Icon name="mdi:chart-bar" class="text-paddle-teal" />
          Generation Results
        </h3>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100">
              <Icon name="mdi:gamepad-variant" class="text-3xl text-blue-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-blue-700">{{ scheduleStats.totalGames }}</div>
              <div class="text-sm font-medium text-blue-600">Total Games</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-paddle-teal/10 to-paddle-teal/20">
              <Icon name="mdi:counter" class="text-3xl text-paddle-teal mb-2 mx-auto" />
              <div class="text-2xl font-bold text-paddle-teal">{{ scheduleStats.totalRounds }}</div>
              <div class="text-sm font-medium text-paddle-teal-dark">Rounds</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-amber-50 to-amber-100">
              <Icon name="mdi:balance-scale" class="text-3xl text-amber-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-amber-700">{{ scheduleStats.averageSkillDifference }}</div>
              <div class="text-sm font-medium text-amber-600">Avg Skill Diff</div>
            </div>
          </div>
          <div class="content-card overflow-hidden">
            <div class="p-4 text-center bg-gradient-to-br from-purple-50 to-purple-100">
              <Icon name="mdi:seat" class="text-3xl text-purple-600 mb-2 mx-auto" />
              <div class="text-2xl font-bold text-purple-700">{{ scheduleStats.restingPerRound }}</div>
              <div class="text-sm font-medium text-purple-600">Resting per Round</div>
            </div>
          </div>
        </div>

        <div class="text-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
          <Icon name="mdi:clock-check" class="text-paddle-teal mr-2" />
          <span class="text-sm font-medium text-gray-700">
            Generated: {{ formatDateTime(scheduleStats.generatedAt) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
