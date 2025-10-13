<script setup lang="ts">
import type { MatchingOptions, Player } from '~/types';

// Define emits
const emit = defineEmits<{
  switchTab: [tabKey: string];
}>();

const playerStore = usePlayerStore();
const gameStore = useGameStore();

const toast = useToast();

// Local reactive state
const eventLabel = ref('');
const matchingOptions = ref<MatchingOptions>({ ...gameStore.matchingOptions });
const isSavingPreferences = ref(false);

// Player filtering state
const playerSearchQuery = ref('');
const skillLevelFilter = ref('all');

// First round sitters selection
const firstRoundSitters = ref<string[]>([...(gameStore.matchingOptions.firstRoundSitters || [])]);

// Flag to prevent saving when updating from store
const isUpdatingFromStore = ref(false);

// Maintain a separate copy of the options for comparison
const previousOptions = ref<MatchingOptions | null>(null);

// Debounced save function to avoid saving on every keystroke
let saveTimeout: NodeJS.Timeout | null = null;

// Helper function to compare MatchingOptions
function optionsAreEqual(a: MatchingOptions, b: MatchingOptions): boolean {
  // Compare arrays properly
  const aFirstRoundSitters = a.firstRoundSitters || [];
  const bFirstRoundSitters = b.firstRoundSitters || [];
  const firstRoundSittersEqual =
    aFirstRoundSitters.length === bFirstRoundSitters.length &&
    aFirstRoundSitters.every((id, index) => id === bFirstRoundSitters[index]);

  return (
    a.numberOfCourts === b.numberOfCourts &&
    a.numberOfRounds === b.numberOfRounds &&
    a.balanceSkillLevels === b.balanceSkillLevels &&
    a.respectPartnerPreferences === b.respectPartnerPreferences &&
    a.maxSkillDifference === b.maxSkillDifference &&
    a.distributeRestEqually === b.distributeRestEqually &&
    firstRoundSittersEqual
  );
}

// Watch for changes and update the game generator
watch(
  matchingOptions,
  async newOptions => {
    // Don't save if the change came from the store
    if (isUpdatingFromStore.value) {
      //console.log('🔄 Skipping save - updating from store');
      return;
    }

    // Create a deep copy of the new options
    const newOptionsCopy = JSON.parse(JSON.stringify(newOptions));

    // Don't save if values haven't actually changed (deep comparison)
    if (previousOptions.value && optionsAreEqual(newOptionsCopy, previousOptions.value)) {
      return;
    }

    // console.log('💾 User changed preferences, scheduling save...');

    // Store the current options for next comparison
    previousOptions.value = newOptionsCopy;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Debounce the save operation
    saveTimeout = setTimeout(async () => {
      try {
        //console.log('💾 Saving preferences to Supabase...');
        isSavingPreferences.value = true;
        await gameStore.updateOptions(newOptions);
        //console.log('✅ Preferences saved successfully');
        // Only show success toast occasionally to avoid spam
        if (Math.random() < 0.3) {
          // 30% chance to show success message
          toast.add({
            title: 'Preferences Saved',
            description: 'Your preferences have been automatically saved.',
            color: 'success'
          });
        }
      } catch (error) {
        console.error('❌ Failed to save preferences:', error);
        // Always show error toast
        toast.add({
          title: 'Save Failed',
          description: 'Failed to save your preferences. Please try again.',
          color: 'error'
        });
      } finally {
        isSavingPreferences.value = false;
      }
    }, 1500); // 1.5 second debounce
  },
  { deep: true }
);

// Watch for changes to firstRoundSitters and update matchingOptions
watch(
  firstRoundSitters,
  newSitters => {
    // Create a new options object to ensure reactivity triggers
    matchingOptions.value = {
      ...matchingOptions.value,
      firstRoundSitters: newSitters.length > 0 ? [...newSitters] : undefined
    };
  },
  { deep: true }
);

// Watch for store matching options changes (e.g., when loaded from Supabase)
watch(
  () => gameStore.matchingOptions,
  newStoreOptions => {
    isUpdatingFromStore.value = true;
    matchingOptions.value = { ...newStoreOptions };
    nextTick(() => {
      isUpdatingFromStore.value = false;
    });
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
const selectedPlayers = computed(() => playerStore.selectedPlayers);

const filteredPlayers = computed(() => {
  let filtered = playerStore.players;

  // Apply search filter
  if (playerSearchQuery.value) {
    const query = playerSearchQuery.value.toLowerCase();
    filtered = filtered.filter((player: Player) => player.name.toLowerCase().includes(query));
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

const playersPerRound = computed(() => {
  return matchingOptions.value.numberOfCourts * 4;
});

const restingPerRound = computed(() => {
  return Math.max(0, selectedPlayers.value.length - playersPerRound.value);
});

const maxFirstRoundSitters = computed(() => {
  return Math.min(4, restingPerRound.value);
});

// Format ALL selected players for USelectMenu (needs specific format)
const allPlayersForSittingOptions = computed(() => {
  // Include ALL selected players so v-model can find both selected and unselected
  const options = selectedPlayers.value.map(player => ({
    label: player.name,
    value: player.id,
    ...player // Include all player properties
  }));
  return options;
});

// Convert between player IDs and player objects for v-model
const selectedFirstRoundSitterObjects = computed({
  get: () => {
    // Return the selected objects from all options
    return allPlayersForSittingOptions.value.filter(opt => firstRoundSitters.value.includes(opt.value));
  },
  set: (selectedOptions: Array<{ label: string; value: string }>) => {
    firstRoundSitters.value = selectedOptions.map(opt => opt.value);
  }
});

const averageSkillLevel = computed(() => {
  if (selectedPlayers.value.length === 0) {
    return '0.0';
  }
  const total = selectedPlayers.value.reduce((sum: number, player: Player) => {
    return sum + player.skillLevel;
  }, 0);
  return (total / selectedPlayers.value.length).toFixed(1);
});

const validationResult = computed(() => gameStore.validateOptions());

const canGenerate = computed(() => validationResult.value.valid);

const validationErrors = computed(() => validationResult.value.errors);

const validationWarnings = computed(() => validationResult.value.warnings || []);

// Methods
function selectFilteredPlayers(): void {
  filteredPlayers.value.forEach((player: Player) => {
    if (!playerStore.isPlayerSelected(player.id)) {
      playerStore.togglePlayerSelection(player.id);
    }
  });
}

function deselectFilteredPlayers(): void {
  filteredPlayers.value.forEach((player: Player) => {
    if (playerStore.isPlayerSelected(player.id)) {
      playerStore.togglePlayerSelection(player.id);
    }
  });
}

function clearAllFilters(): void {
  playerSearchQuery.value = '';
  skillLevelFilter.value = 'all';
}

function toggleFirstRoundSitter(playerId: string): void {
  const index = firstRoundSitters.value.indexOf(playerId);
  if (index > -1) {
    firstRoundSitters.value.splice(index, 1);
  } else {
    if (firstRoundSitters.value.length < maxFirstRoundSitters.value) {
      firstRoundSitters.value.push(playerId);
    } else {
      toast.add({
        title: 'Maximum Reached',
        description: `You can only select up to ${maxFirstRoundSitters.value} players to sit out in the first round.`,
        color: 'warning'
      });
    }
  }
}

function clearFirstRoundSitters(): void {
  firstRoundSitters.value = [];
}

async function generateSchedule(): Promise<void> {
  try {
    const schedule = await gameStore.generateSchedule(eventLabel.value);
    if (schedule) {
      toast.add({
        title: 'Schedule Generated',
        description: `Successfully created ${schedule.rounds.length} rounds with ${schedule.rounds.reduce((sum, round) => sum + round.length, 0)} total games.`,
        color: 'success'
      });

      // Switch to schedule tab after successful generation
      emit('switchTab', 'schedule');
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

function resetToDefaults(): void {
  isUpdatingFromStore.value = true;
  gameStore.resetOptions();
  matchingOptions.value = { ...gameStore.matchingOptions };
  firstRoundSitters.value = [];
  nextTick(() => {
    isUpdatingFromStore.value = false;
  });
  toast.add({
    title: 'Options Reset',
    description: 'All options have been reset to default values.',
    color: 'info'
  });
}

// Initialize with current options
onMounted(() => {
  isUpdatingFromStore.value = true;
  matchingOptions.value = { ...gameStore.matchingOptions };
  firstRoundSitters.value = [...(gameStore.matchingOptions.firstRoundSitters || [])];
  nextTick(() => {
    isUpdatingFromStore.value = false;
  });
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Game Generation
            <div v-if="isSavingPreferences" class="flex items-center gap-2 text-sm text-gray-500">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
              <span>Saving...</span>
            </div>
          </h2>
          <div class="flex gap-3">
            <UButton
              :disabled="!canGenerate || gameStore.isGenerating"
              :loading="gameStore.isGenerating"
              size="lg"
              class="btn-primary"
              data-testid="generate-games-button"
              @click="generateSchedule"
            >
              <UIcon name="i-heroicons-play" class="mr-2" />
              Generate Schedule
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Validation Messages -->
    <div v-if="validationErrors.length > 0" class="alert-error p-4 rounded-xl flex items-start gap-3">
      <Icon name="mdi:alert-circle" class="text-xl text-paddle-red mt-1" />
      <div>
        <p class="font-semibold">Cannot Generate Schedule</p>
        <p class="text-sm">{{ validationErrors.join(', ') }}</p>
      </div>
    </div>

    <!-- Validation Warnings -->
    <div
      v-if="validationWarnings.length > 0"
      class="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3"
    >
      <Icon name="mdi:alert" class="text-xl text-yellow-600 mt-1" />
      <div>
        <p class="font-semibold text-yellow-800">Warning</p>
        <p class="text-sm text-yellow-700">{{ validationWarnings.join(', ') }}</p>
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

          <!-- First Round Sitters -->
          <UFormField
            v-if="restingPerRound > 0"
            label="First Round Sitters (Optional)"
            :help="`Select up to ${maxFirstRoundSitters} players to sit out in the first round`"
          >
            <div class="space-y-3">
              <div v-if="firstRoundSitters.length > 0" class="flex flex-wrap gap-2">
                <UBadge
                  v-for="playerId in firstRoundSitters"
                  :key="playerId"
                  color="warning"
                  variant="soft"
                  class="cursor-pointer"
                  @click="toggleFirstRoundSitter(playerId)"
                >
                  {{ playerStore.getPlayer(playerId)?.name }}
                  <UIcon name="i-heroicons-x-mark" class="ml-1" />
                </UBadge>
              </div>
              <div v-else class="text-sm text-gray-500 italic">No players selected to sit out first round</div>
              <div v-if="firstRoundSitters.length < maxFirstRoundSitters" class="space-y-2">
                <USelectMenu
                  v-model="selectedFirstRoundSitterObjects"
                  :items="allPlayersForSittingOptions"
                  multiple
                  placeholder="Select players to sit out first round..."
                  class="w-full"
                />
              </div>
              <UButton
                v-if="firstRoundSitters.length > 0"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="clearFirstRoundSitters"
              >
                <UIcon name="i-heroicons-x-mark" />
                Clear All
              </UButton>
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
            <UButton variant="ghost" size="sm" class="btn-secondary" @click="playerStore.selectAllPlayers()">
              Select All
            </UButton>
            <UButton variant="ghost" size="sm" class="btn-secondary" @click="playerStore.deselectAllPlayers()">
              Deselect All
            </UButton>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- Filter Controls -->
        <div
          class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600"
        >
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
              <USelect v-model="skillLevelFilter" :items="skillLevelFilterOptions" class="form-input w-full u-select" />
            </UFormField>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Icon name="mdi:information" class="text-paddle-teal dark:text-paddle-teal-light" />
            <span>
              Showing {{ filteredPlayers.length }} of {{ playerStore.players.length }} players. You need at least
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

        <div v-if="playerStore.players.length === 0" class="text-center py-8 text-gray-500">
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
              playerStore.isPlayerSelected(player.id)
                ? 'border-paddle-teal bg-paddle-teal/5'
                : 'border-gray-200 hover:border-paddle-teal/50'
            ]"
            @click="playerStore.togglePlayerSelection(player.id)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-full bg-gradient-to-br from-paddle-teal to-paddle-teal-light flex items-center justify-center text-white font-bold text-xs"
                >
                  {{ player.name.charAt(0).toUpperCase() }}
                </div>
                <div class="flex flex-row align-items-center">
                  <span class="text-sm font-medium">{{ player.name }}</span>
                  <div v-if="player.partnerId" class="text-xs text-gray-600 flex items-center gap-1 ml-4">
                    <Icon name="mdi:account-heart" />
                    Partner: {{ playerStore.getPlayer(player.partnerId)?.name || 'Unknown' }}
                  </div>
                </div>
              </div>
              <div class="player-skill-badge text-xs">
                {{ player.skillLevel }}
              </div>
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
  </div>
</template>
