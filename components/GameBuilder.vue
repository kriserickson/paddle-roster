<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Player } from '~/types';
import { copyMatchingOptions } from '~/utils/matchingOptions';

const PLAYERS_PER_COURT = 4;
const MAX_COURTS = 4;
const MAX_ROUNDS = 15;
const BEGINNER_SKILL_CEILING = 2.75;
const INTERMEDIATE_SKILL_CEILING = 3.5;
const PERCENT = 100;
const SAVE_DELAY_MS = 700;

const emit = defineEmits<{
  switchTab: [tabKey: string];
}>();

const playerStore = usePlayerStore();
const gameStore = useGameStore();
const toast = useToast();
const { matchingOptions } = storeToRefs(gameStore);

const eventLabel = ref('');
const playerSearchQuery = ref('');
const skillLevelFilter = ref('all');
const showAdvancedPreferences = ref(false);
const isSavingPreferences = ref(false);
const didPrepareRoster = ref(false);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const skillLevelFilterOptions = [
  { label: 'All levels', value: 'all' },
  { label: 'Beginner · 1.0–2.75', value: 'beginner' },
  { label: 'Intermediate · 3.0–3.5', value: 'intermediate' },
  { label: 'Advanced · 3.6–5.0', value: 'advanced' }
];

const preferencePriorityOptions = [
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Strict', value: 'strict' }
];

const selectedPlayers = computed(() => playerStore.selectedPlayers);

const filteredPlayers = computed(() => {
  const query = playerSearchQuery.value.trim().toLowerCase();
  return playerStore.players.filter((player: Player) => {
    const matchesName = !query || player.name.toLowerCase().includes(query);
    const matchesSkill =
      skillLevelFilter.value === 'all' ||
      (skillLevelFilter.value === 'beginner' && player.skillLevel <= BEGINNER_SKILL_CEILING) ||
      (skillLevelFilter.value === 'intermediate' &&
        player.skillLevel > BEGINNER_SKILL_CEILING &&
        player.skillLevel <= INTERMEDIATE_SKILL_CEILING) ||
      (skillLevelFilter.value === 'advanced' && player.skillLevel > INTERMEDIATE_SKILL_CEILING);
    return matchesName && matchesSkill;
  });
});

const hasActiveFilters = computed(() => playerSearchQuery.value.length > 0 || skillLevelFilter.value !== 'all');
const playersPerRound = computed(() => matchingOptions.value.numberOfCourts * PLAYERS_PER_COURT);
const restingPerRound = computed(() => Math.max(0, selectedPlayers.value.length - playersPerRound.value));
const effectiveCourts = computed(() =>
  Math.min(matchingOptions.value.numberOfCourts, Math.floor(selectedPlayers.value.length / PLAYERS_PER_COURT))
);
const estimatedGames = computed(() => effectiveCourts.value * matchingOptions.value.numberOfRounds);
const averageSkillLevel = computed(() => {
  if (!selectedPlayers.value.length) return '—';
  const total = selectedPlayers.value.reduce((sum, player) => sum + player.skillLevel, 0);
  return (total / selectedPlayers.value.length).toFixed(1);
});
const selectionProgress = computed(() => {
  if (!playersPerRound.value) return 0;
  return Math.min(PERCENT, Math.round((selectedPlayers.value.length / playersPerRound.value) * PERCENT));
});
const validationResult = computed(() => gameStore.validateOptions());
const validationErrors = computed(() => validationResult.value.errors);
const validationWarnings = computed(() => validationResult.value.warnings || []);
const canGenerate = computed(() => validationResult.value.valid);
const firstRoundSitters = computed({
  get: () => matchingOptions.value.firstRoundSitters || [],
  set: (value: string[]) => {
    matchingOptions.value.firstRoundSitters = value.length ? value : undefined;
  }
});
const maxFirstRoundSitters = computed(() => Math.min(PLAYERS_PER_COURT, restingPerRound.value));
const firstRoundSitterOptions = computed(() =>
  selectedPlayers.value.map(player => ({ label: player.name, value: player.id }))
);
const selectedFirstRoundSitterObjects = computed({
  get: () => firstRoundSitterOptions.value.filter(option => firstRoundSitters.value.includes(option.value)),
  set: (options: Array<{ label: string; value: string }>) => {
    firstRoundSitters.value = options.slice(0, maxFirstRoundSitters.value).map(option => option.value);
  }
});
const setupStatus = computed(() => {
  if (selectedPlayers.value.length < PLAYERS_PER_COURT) {
    const remaining = PLAYERS_PER_COURT - selectedPlayers.value.length;
    return `${remaining} more player${remaining === 1 ? '' : 's'} needed`;
  }
  if (validationErrors.value.length) return 'Setup needs attention';
  if (validationWarnings.value.length) return 'Ready with an adjustment';
  return 'Ready to generate';
});

watch(
  matchingOptions,
  options => {
    if (saveTimeout) clearTimeout(saveTimeout);
    isSavingPreferences.value = true;
    saveTimeout = setTimeout(async () => {
      await gameStore.updateOptions(copyMatchingOptions(options));
      isSavingPreferences.value = false;
    }, SAVE_DELAY_MS);
  },
  { deep: true }
);

watch(
  () => playerStore.players.length,
  playerCount => {
    if (didPrepareRoster.value || playerCount < PLAYERS_PER_COURT || selectedPlayers.value.length > 0) return;
    didPrepareRoster.value = true;
    if (playerCount <= MAX_COURTS * PLAYERS_PER_COURT + PLAYERS_PER_COURT) {
      playerStore.selectAllPlayers();
      matchingOptions.value.numberOfCourts = Math.min(MAX_COURTS, Math.floor(playerCount / PLAYERS_PER_COURT));
    }
  },
  { immediate: true }
);

watch(restingPerRound, restCount => {
  if (!restCount) firstRoundSitters.value = [];
  else if (firstRoundSitters.value.length > restCount)
    firstRoundSitters.value = firstRoundSitters.value.slice(0, restCount);
});

onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout);
});

function adjustCourts(amount: number): void {
  matchingOptions.value.numberOfCourts = Math.min(
    MAX_COURTS,
    Math.max(1, matchingOptions.value.numberOfCourts + amount)
  );
}

function adjustRounds(amount: number): void {
  matchingOptions.value.numberOfRounds = Math.min(
    MAX_ROUNDS,
    Math.max(1, matchingOptions.value.numberOfRounds + amount)
  );
}

function selectFilteredPlayers(): void {
  filteredPlayers.value.forEach(player => {
    if (!playerStore.isPlayerSelected(player.id)) playerStore.togglePlayerSelection(player.id);
  });
}

function deselectFilteredPlayers(): void {
  filteredPlayers.value.forEach(player => {
    if (playerStore.isPlayerSelected(player.id)) playerStore.togglePlayerSelection(player.id);
  });
}

function clearAllFilters(): void {
  playerSearchQuery.value = '';
  skillLevelFilter.value = 'all';
}

async function resetToDefaults(): Promise<void> {
  await gameStore.resetOptions();
  toast.add({
    color: 'info',
    description: 'Your schedule settings are back to their defaults.',
    title: 'Settings reset'
  });
}

async function generateSchedule(): Promise<void> {
  if (!canGenerate.value) return;
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    await gameStore.updateOptions(copyMatchingOptions(matchingOptions.value));
    const schedule = await gameStore.generateSchedule(eventLabel.value.trim());
    if (!schedule) return;
    toast.add({
      color: 'success',
      description: `${schedule.rounds.length} rounds and ${schedule.rounds.reduce((sum, round) => sum + round.length, 0)} games are ready.`,
      title: 'Schedule ready'
    });
    emit('switchTab', 'schedule');
  } catch (error) {
    toast.add({
      color: 'error',
      description: error instanceof Error ? error.message : 'We could not generate this schedule.',
      title: 'Generation failed'
    });
  }
}
</script>

<template>
  <div class="builder-page">
    <div class="section-intro">
      <div>
        <span class="eyebrow">Schedule builder</span>
        <h2>Set up your next session</h2>
        <p>Choose who is playing, set the court format, and let Paddle Roster handle the rotation.</p>
      </div>
      <div class="save-state" :class="{ saving: isSavingPreferences }">
        <UIcon
          :name="isSavingPreferences ? 'i-lucide-loader-circle' : 'i-lucide-cloud-check'"
          :class="{ 'animate-spin': isSavingPreferences }"
        />
        {{ isSavingPreferences ? 'Saving setup' : 'Setup saved' }}
      </div>
    </div>

    <div class="builder-stats" aria-label="Schedule summary">
      <div class="builder-stat primary">
        <UIcon name="i-lucide-users-round" />
        <span
          ><strong>{{ selectedPlayers.length }}</strong
          ><small>players</small></span
        >
      </div>
      <div class="builder-stat">
        <UIcon name="i-lucide-layout-grid" />
        <span
          ><strong>{{ effectiveCourts }}</strong
          ><small>courts in use</small></span
        >
      </div>
      <div class="builder-stat">
        <UIcon name="i-lucide-repeat-2" />
        <span
          ><strong>{{ matchingOptions.numberOfRounds }}</strong
          ><small>rounds</small></span
        >
      </div>
      <div class="builder-stat">
        <UIcon name="i-lucide-sparkles" />
        <span
          ><strong>{{ estimatedGames }}</strong
          ><small>games created</small></span
        >
      </div>
    </div>

    <div
      v-if="validationErrors.length || validationWarnings.length"
      class="setup-message"
      :class="validationErrors.length ? 'error' : 'warning'"
    >
      <UIcon :name="validationErrors.length ? 'i-lucide-circle-alert' : 'i-lucide-triangle-alert'" />
      <div>
        <strong>{{ validationErrors.length ? 'A quick fix is needed' : 'We’ll adjust this automatically' }}</strong>
        <p>{{ (validationErrors.length ? validationErrors : validationWarnings).join(' · ') }}</p>
      </div>
    </div>

    <div class="builder-layout">
      <section class="panel roster-panel">
        <div class="panel-heading">
          <div>
            <span class="step-label">1 · Choose players</span>
            <h3>Who’s on the court today?</h3>
          </div>
          <div class="selection-count">{{ selectedPlayers.length }} selected</div>
        </div>

        <div class="selection-meter" aria-hidden="true">
          <span :style="{ width: `${selectionProgress}%` }" />
        </div>
        <p class="selection-hint">
          {{ playersPerRound }} players fill {{ matchingOptions.numberOfCourts }} court{{
            matchingOptions.numberOfCourts === 1 ? '' : 's'
          }}.
          <template v-if="restingPerRound"> {{ restingPerRound }} will rotate off each round.</template>
        </p>

        <div class="roster-toolbar">
          <UInput
            v-model="playerSearchQuery"
            icon="i-lucide-search"
            placeholder="Find a player"
            aria-label="Find a player"
            class="roster-search"
          />
          <USelect v-model="skillLevelFilter" :items="skillLevelFilterOptions" aria-label="Filter by skill level" />
          <UButton
            v-if="hasActiveFilters"
            icon="i-lucide-x"
            variant="ghost"
            color="neutral"
            aria-label="Clear filters"
            @click="clearAllFilters"
          />
        </div>

        <div class="roster-actions">
          <span>Showing {{ filteredPlayers.length }} of {{ playerStore.players.length }}</span>
          <div>
            <button type="button" @click="selectFilteredPlayers">Select shown</button>
            <button type="button" @click="deselectFilteredPlayers">Clear shown</button>
          </div>
        </div>

        <div v-if="playerStore.players.length === 0" class="empty-state">
          <span class="empty-icon"><UIcon name="i-lucide-user-round-plus" /></span>
          <h4>Your roster is empty</h4>
          <p>Add players in the Players step before building a schedule.</p>
        </div>
        <div v-else-if="filteredPlayers.length === 0" class="empty-state compact">
          <span class="empty-icon"><UIcon name="i-lucide-search-x" /></span>
          <h4>No players found</h4>
          <p>Try another name or skill level.</p>
        </div>
        <div v-else class="player-choice-grid">
          <button
            v-for="player in filteredPlayers"
            :key="player.id"
            type="button"
            class="player-choice"
            :class="{ selected: playerStore.isPlayerSelected(player.id) }"
            :aria-pressed="playerStore.isPlayerSelected(player.id)"
            @click="playerStore.togglePlayerSelection(player.id)"
          >
            <span class="player-avatar">{{ player.name.charAt(0).toUpperCase() }}</span>
            <span class="player-details">
              <strong>{{ player.name }}</strong>
              <small v-if="player.partnerId"
                ><UIcon name="i-lucide-link" /> {{ playerStore.getPlayer(player.partnerId)?.name }}</small
              >
              <small v-else>Open pairing</small>
            </span>
            <span class="skill-chip">{{ player.skillLevel }}</span>
            <span class="choice-check"><UIcon name="i-lucide-check" /></span>
          </button>
        </div>
      </section>

      <aside class="builder-sidebar">
        <section class="panel settings-panel">
          <div class="panel-heading compact">
            <div>
              <span class="step-label">2 · Set the format</span>
              <h3>Session details</h3>
            </div>
          </div>

          <UFormField label="Schedule name" help="Optional — useful when printing or sharing">
            <UInput v-model="eventLabel" icon="i-lucide-tag" placeholder="Tuesday evening club play" class="w-full" />
          </UFormField>

          <div class="counter-setting">
            <div>
              <strong>Courts</strong>
              <span>Available at your venue</span>
            </div>
            <div class="counter-control">
              <button
                type="button"
                :disabled="matchingOptions.numberOfCourts <= 1"
                aria-label="Use one fewer court"
                @click="adjustCourts(-1)"
              >
                <UIcon name="i-lucide-minus" />
              </button>
              <strong>{{ matchingOptions.numberOfCourts }}</strong>
              <button
                type="button"
                :disabled="matchingOptions.numberOfCourts >= MAX_COURTS"
                aria-label="Use one more court"
                @click="adjustCourts(1)"
              >
                <UIcon name="i-lucide-plus" />
              </button>
            </div>
          </div>

          <div class="counter-setting">
            <div>
              <strong>Rounds</strong>
              <span>Most sessions use 7–9</span>
            </div>
            <div class="counter-control">
              <button
                type="button"
                :disabled="matchingOptions.numberOfRounds <= 1"
                aria-label="Generate one fewer round"
                @click="adjustRounds(-1)"
              >
                <UIcon name="i-lucide-minus" />
              </button>
              <strong>{{ matchingOptions.numberOfRounds }}</strong>
              <button
                type="button"
                :disabled="matchingOptions.numberOfRounds >= MAX_ROUNDS"
                aria-label="Generate one more round"
                @click="adjustRounds(1)"
              >
                <UIcon name="i-lucide-plus" />
              </button>
            </div>
          </div>

          <div class="preference-list">
            <label class="preference-row">
              <span class="preference-icon mint"><UIcon name="i-lucide-scale" /></span>
              <span><strong>Balance team skill</strong><small>Keep matchups competitive</small></span>
              <USwitch v-model="matchingOptions.balanceSkillLevels" aria-label="Balance team skill" />
            </label>
            <label class="preference-row">
              <span class="preference-icon coral"><UIcon name="i-lucide-heart-handshake" /></span>
              <span><strong>Honor partners</strong><small>Pair requests at least once</small></span>
              <USwitch v-model="matchingOptions.respectPartnerPreferences" aria-label="Honor partner preferences" />
            </label>
            <label class="preference-row">
              <span class="preference-icon amber"><UIcon name="i-lucide-armchair" /></span>
              <span><strong>Share rest evenly</strong><small>Rotate sit-outs fairly</small></span>
              <USwitch v-model="matchingOptions.distributeRestEqually" aria-label="Share rest evenly" />
            </label>
          </div>

          <button
            type="button"
            class="advanced-toggle"
            :aria-expanded="showAdvancedPreferences"
            @click="showAdvancedPreferences = !showAdvancedPreferences"
          >
            <span><UIcon name="i-lucide-sliders-horizontal" /> Fine-tune matching</span>
            <UIcon :name="showAdvancedPreferences ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
          </button>

          <div v-if="showAdvancedPreferences" class="advanced-settings">
            <UFormField label="Maximum team skill gap" help="Lower values create tighter matchups">
              <div class="range-value">{{ matchingOptions.maxSkillDifference.toFixed(2) }}</div>
              <USlider v-model="matchingOptions.maxSkillDifference" :min="0.5" :max="4" :step="0.25" />
            </UFormField>
            <UFormField label="Opponent variety">
              <USelect
                v-model="matchingOptions.opponentDiversityPriority"
                :items="preferencePriorityOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Court variety">
              <USelect
                v-model="matchingOptions.courtDiversityPriority"
                :items="preferencePriorityOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="restingPerRound > 0"
              label="First-round sit-outs"
              :help="`Choose up to ${maxFirstRoundSitters}`"
            >
              <USelectMenu
                v-model="selectedFirstRoundSitterObjects"
                :items="firstRoundSitterOptions"
                multiple
                placeholder="Let Paddle Roster decide"
                class="w-full"
              />
            </UFormField>
            <button type="button" class="reset-link" @click="resetToDefaults">
              <UIcon name="i-lucide-rotate-ccw" /> Reset defaults
            </button>
          </div>
        </section>

        <section class="generate-card" :class="{ ready: canGenerate }">
          <div class="generate-status">
            <span><UIcon :name="canGenerate ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'" /></span>
            <div>
              <strong>{{ setupStatus }}</strong
              ><small
                >{{ selectedPlayers.length }} players · {{ effectiveCourts }} courts ·
                {{ matchingOptions.numberOfRounds }} rounds</small
              >
            </div>
          </div>
          <div class="generate-outcome">
            <span>Expected output</span>
            <strong>{{ estimatedGames }} balanced games</strong>
            <small>Average selected skill · {{ averageSkillLevel }}</small>
          </div>
          <UButton
            :disabled="!canGenerate || gameStore.isGenerating"
            :loading="gameStore.isGenerating"
            size="xl"
            icon="i-lucide-wand-sparkles"
            class="generate-button"
            data-testid="generate-games-button"
            @click="generateSchedule"
          >
            {{ gameStore.isGenerating ? 'Building your schedule' : 'Generate schedule' }}
          </UButton>
          <p><UIcon name="i-lucide-shield-check" /> Your current roster stays unchanged.</p>
        </section>
      </aside>
    </div>
  </div>
</template>
