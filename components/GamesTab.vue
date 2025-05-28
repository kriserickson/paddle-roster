<script setup lang="ts">
import type { MatchingOptions } from '~/types';

const playerStore = usePlayerStore();
const gameStore = useGameStore();

const toast = useToast();

// Local reactive state
const eventLabel = ref('');
const matchingOptions = ref<MatchingOptions>({ ...gameStore.matchingOptions });

// Watch for changes and update the game generator
watch(matchingOptions, (newOptions) => {
  gameStore.updateOptions(newOptions);
}, { deep: true });

// Court options
const courtOptions = [
  { label: '1 Court', value: 1 },
  { label: '2 Courts', value: 2 },
  { label: '3 Courts', value: 3 },
  { label: '4 Courts', value: 4 }
];

// Computed properties
const activePlayers = computed(() => playerStore.activePlayers);

const scheduleStats = computed(() => gameStore.scheduleStats);

const playersPerRound = computed(() => {
  return matchingOptions.value.numberOfCourts * 4;
});

const restingPerRound = computed(() => {
  return Math.max(0, activePlayers.value.length - playersPerRound.value);
});

const averageSkillLevel = computed(() => {
  if (activePlayers.value.length === 0) return '0.0';
  const total = activePlayers.value.reduce((sum, player) => sum + player.skillLevel, 0);
  return (total / activePlayers.value.length).toFixed(1);
});

const validationResult = computed(() => gameStore.validateOptions());

const canGenerate = computed(() => validationResult.value.valid);

const validationErrors = computed(() => validationResult.value.errors);

// Methods
const getSkillLevelColor = (skillLevel: number): "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral" => {
  if (skillLevel < 2) return 'error';
  if (skillLevel < 3) return 'warning';
  if (skillLevel < 4) return 'info';
  if (skillLevel < 5) return 'success';
  return 'primary';
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const generateGames = async (): Promise<void> => {
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
};

const regenerateGames = async (): Promise<void> => {
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
};

const resetToDefaults = (): void => {
  gameStore.resetOptions();
  matchingOptions.value = { ...gameStore.matchingOptions };
  toast.add({
    title: 'Options Reset',
    description: 'All options have been reset to default values.',
    color: 'info'
  });
};

// Initialize with current options
onMounted(() => {
  matchingOptions.value = { ...gameStore.matchingOptions };
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold text-gray-900">Game Generation</h2>      <div class="flex gap-2">
        <UButton
          :disabled="!canGenerate || gameStore.isGenerating"
          :loading="gameStore.isGenerating"
          color="primary"
          size="lg"
          @click="generateGames"
        >
          <UIcon name="i-heroicons-play" class="mr-2" />
          Generate Schedule
        </UButton>
        <UButton
          v-if="gameStore.currentSchedule"
          :disabled="gameStore.isGenerating"
          variant="outline"
          @click="regenerateGames"
        >
          <UIcon name="i-heroicons-arrow-path" class="mr-2" />
          Regenerate
        </UButton>
      </div>
    </div>

    <!-- Validation Messages -->
    <UAlert
      v-if="validationErrors.length > 0"
      color="error"
      variant="solid"
      :title="'Cannot Generate Games'"
      :description="validationErrors.join(', ')"
    />

    <!-- Configuration -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Game Settings -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium flex items-center">
            <UIcon name="i-heroicons-cog-6-tooth" class="mr-2" />
            Game Settings
          </h3>
        </template>

        <div class="space-y-4">
          <!-- Event Label -->
          <UFormGroup label="Event Label" help="Optional label for the schedule (e.g., 'Tuesday May 28th')">
            <UInput
              v-model="eventLabel"
              placeholder="e.g., John Henry Secondary School Tuesday May 9th"
            />
          </UFormGroup>

          <!-- Number of Courts -->
          <UFormGroup label="Number of Courts" help="How many courts are available for games">
            <USelect
              v-model="matchingOptions.numberOfCourts"
              :options="courtOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormGroup>

          <!-- Number of Rounds -->
          <UFormGroup label="Number of Rounds" help="How many rounds to generate (typically 7-9)">
            <URange
              v-model="matchingOptions.numberOfRounds"
              :min="1"
              :max="15"
              :step="1"
              class="mb-2"
            />
            <div class="text-sm text-gray-600 text-center">
              {{ matchingOptions.numberOfRounds }} rounds
            </div>
          </UFormGroup>

          <!-- Max Skill Difference -->
          <UFormGroup label="Maximum Skill Difference" help="Maximum allowed skill difference between teams">
            <URange
              v-model="matchingOptions.maxSkillDifference"
              :min="0.5"
              :max="4.0"
              :step="0.25"
              class="mb-2"
            />
            <div class="text-sm text-gray-600 text-center">
              {{ matchingOptions.maxSkillDifference }}
            </div>
          </UFormGroup>
        </div>
      </UCard>

      <!-- Algorithm Options -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium flex items-center">
            <UIcon name="i-heroicons-adjustments-horizontal" class="mr-2" />
            Algorithm Options
          </h3>
        </template>

        <div class="space-y-4">
          <UFormGroup 
            label="Balance Skill Levels"
            help="Attempt to create balanced teams by skill level"
          >
            <UToggle
              v-model="matchingOptions.balanceSkillLevels"
              :label="matchingOptions.balanceSkillLevels ? 'Enabled' : 'Disabled'"
            />
          </UFormGroup>

          <UFormGroup 
            label="Respect Partner Preferences"
            help="Try to pair players with their preferred partners in at least one game"
          >
            <UToggle
              v-model="matchingOptions.respectPartnerPreferences"
              :label="matchingOptions.respectPartnerPreferences ? 'Enabled' : 'Disabled'"
            />
          </UFormGroup>

          <UFormGroup 
            label="Distribute Rest Equally"
            help="Ensure all players get equal rest periods"
          >
            <UToggle
              v-model="matchingOptions.distributeRestEqually"
              :label="matchingOptions.distributeRestEqually ? 'Enabled' : 'Disabled'"
            />
          </UFormGroup>

          <!-- Reset Options -->
          <div class="pt-4 border-t">
            <UButton
              variant="ghost"
              size="sm"
              @click="resetToDefaults"
            >
              Reset to Defaults
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Player Summary -->
    <UCard>
      <template #header>
        <h3 class="text-lg font-medium flex items-center">
          <UIcon name="i-heroicons-users" class="mr-2" />
          Active Players Summary
        </h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ activePlayers.length }}</div>
          <div class="text-sm text-gray-600">Active Players</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ playersPerRound }}</div>
          <div class="text-sm text-gray-600">Players per Round</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600">{{ restingPerRound }}</div>
          <div class="text-sm text-gray-600">Resting per Round</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">{{ averageSkillLevel }}</div>
          <div class="text-sm text-gray-600">Avg Skill Level</div>
        </div>
      </div>

      <!-- Player List -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        <div
          v-for="player in activePlayers"
          :key="player.id"
          class="flex items-center justify-between p-2 bg-gray-50 rounded"
        >
          <span class="text-sm">{{ player.name }}</span>
          <UBadge
            :color="getSkillLevelColor(player.skillLevel)"
            variant="subtle"
            size="xs"
          >
            {{ player.skillLevel }}
          </UBadge>
        </div>
      </div>

      <div v-if="activePlayers.length === 0" class="text-center py-8 text-gray-500">
        No active players found. Add some players first.
      </div>
    </UCard>    <!-- Generation Progress -->
    <UCard v-if="gameStore.isGenerating">
      <div class="text-center py-8">
        <UIcon name="i-heroicons-cog-6-tooth" class="text-4xl text-blue-500 animate-spin mb-4" />
        <h3 class="text-lg font-medium mb-2">Generating Schedule...</h3>
        <p class="text-gray-600">
          Creating balanced games across {{ matchingOptions.numberOfRounds }} rounds
        </p>
      </div>
    </UCard>    <!-- Generation Results -->
    <UCard v-if="gameStore.currentSchedule && scheduleStats">
      <template #header>
        <h3 class="text-lg font-medium flex items-center">
          <UIcon name="i-heroicons-chart-bar" class="mr-2" />
          Generation Results
        </h3>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ scheduleStats.totalGames }}</div>
          <div class="text-sm text-gray-600">Total Games</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ scheduleStats.totalRounds }}</div>
          <div class="text-sm text-gray-600">Rounds</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600">{{ scheduleStats.averageSkillDifference }}</div>
          <div class="text-sm text-gray-600">Avg Skill Diff</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">{{ scheduleStats.restingPerRound }}</div>
          <div class="text-sm text-gray-600">Resting per Round</div>
        </div>
      </div>

      <div class="text-sm text-gray-600 text-center">
        Generated: {{ formatDateTime(scheduleStats.generatedAt) }}
      </div>
    </UCard>
  </div>
</template>
