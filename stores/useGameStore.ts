import { defineStore } from 'pinia';
import { UserPreferencesApiSupabase } from '~/services/userPreferencesApiSupabase';
import type { Game, GameSchedule, MatchingOptions } from '~/types';
import { PickleballMatcher } from '~/utils/pickleballMatcher';

export const useGameStore = defineStore('game', () => {
  /**
   * State
   */
  const currentSchedule = ref<GameSchedule | null>(null);
  const isGenerating = ref(false);
  const isLoadingPreferences = ref(false);

  /**
   * Default matching options (fallback)
   */
  const defaultOptions: MatchingOptions = {
    numberOfCourts: 3,
    numberOfRounds: 7,
    balanceSkillLevels: true,
    respectPartnerPreferences: true,
    maxSkillDifference: 2.0,
    distributeRestEqually: true,
    opponentDiversityPriority: 'balanced',
    courtDiversityPriority: 'balanced'
  };

  const matchingOptions = ref<MatchingOptions>({ ...defaultOptions });
  const preferencesApi = new UserPreferencesApiSupabase();
  const advancedPreferenceStorageKey = 'paddleroster-advanced-matching-preferences';

  function normalizePriority(value: unknown): 'relaxed' | 'balanced' | 'strict' {
    if (value === 'relaxed' || value === 'strict' || value === 'balanced') {
      return value;
    }
    return 'balanced';
  }

  function loadLocalAdvancedPreferences(): Partial<MatchingOptions> {
    if (!process.client) {
      return {};
    }
    try {
      const raw = localStorage.getItem(advancedPreferenceStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Partial<MatchingOptions>;
      return {
        opponentDiversityPriority: normalizePriority(parsed.opponentDiversityPriority),
        courtDiversityPriority: normalizePriority(parsed.courtDiversityPriority)
      };
    } catch (error) {
      console.warn('Failed to load local advanced preferences:', error);
      return {};
    }
  }

  function saveLocalAdvancedPreferences(options: MatchingOptions): void {
    if (!process.client) {
      return;
    }
    try {
      localStorage.setItem(
        advancedPreferenceStorageKey,
        JSON.stringify({
          opponentDiversityPriority: normalizePriority(options.opponentDiversityPriority),
          courtDiversityPriority: normalizePriority(options.courtDiversityPriority)
        })
      );
    } catch (error) {
      console.warn('Failed to save local advanced preferences:', error);
    }
  }

  /**
   * Getters
   */
  const scheduleStats = computed(() => {
    if (!currentSchedule.value) {
      return null;
    }

    const schedule = currentSchedule.value;
    const totalGames = schedule.rounds.reduce((sum, round) => sum + round.length, 0);
    const totalRounds = schedule.rounds.length;
    const playersPerRound = (schedule.rounds[0]?.length || 0) * 4;
    const restingPerRound = schedule.restingPlayers[0]?.length || 0;
    const duplicatePartners = countDuplicatePartnerOccurrences(schedule);
    const duplicateOpponents = countDuplicateOpponentOccurrences(schedule);
    const maxOpponentRepeats = calculateMaxOpponentRepeats(schedule);
    const maxRests = calculateMaxRests(schedule);

    return {
      totalGames,
      totalRounds,
      playersPerRound,
      restingPerRound,
      averageSkillDifference: calculateAverageSkillDifference(schedule),
      duplicatePartners,
      duplicateOpponents,
      maxOpponentRepeats,
      maxRests,
      generatedAt: schedule.generatedAt
    };
  }); /**
   * Actions
   */
  async function generateSchedule(eventLabel: string = ''): Promise<GameSchedule | null> {
    const playerStore = usePlayerStore();

    try {
      isGenerating.value = true;

      const selectedPlayersValue = playerStore.selectedPlayers;

      const maxCourts = Math.floor(selectedPlayersValue.length / 4);
      const actualCourts = Math.min(matchingOptions.value.numberOfCourts, maxCourts);

      // Adjust options for generation
      const generationOptions = { ...matchingOptions.value, numberOfCourts: actualCourts };

      // Create matcher instance
      const matcher = new PickleballMatcher(selectedPlayersValue, generationOptions);

      // Generate schedule
      const schedule = await matcher.generateSchedule(eventLabel);

      currentSchedule.value = schedule;
      return schedule;
    } catch (error) {
      console.error('Error generating schedule:', error);
      throw error;
    } finally {
      isGenerating.value = false;
    }
  }

  /**
   * Load user's saved preferences from Supabase
   */
  async function loadUserPreferences(): Promise<void> {
    try {
      isLoadingPreferences.value = true;
      const userPrefs = await preferencesApi.getUserPreferences();
      matchingOptions.value = {
        ...defaultOptions,
        ...userPrefs.matchingOptions,
        ...loadLocalAdvancedPreferences()
      };
    } catch (error) {
      console.error('Error loading user preferences:', error);
      // Fall back to default options if loading fails
      matchingOptions.value = { ...defaultOptions, ...loadLocalAdvancedPreferences() };
    } finally {
      isLoadingPreferences.value = false;
    }
  }

  /**
   * Save current options as user's preferences
   */
  async function saveUserPreferences(): Promise<void> {
    try {
      const userPrefs = await preferencesApi.getUserPreferences();
      const updatedPrefs = {
        ...userPrefs,
        matchingOptions: { ...matchingOptions.value }
      };
      await preferencesApi.saveUserPreferences(updatedPrefs);
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  }

  async function updateOptions(newOptions: Partial<MatchingOptions>): Promise<void> {
    matchingOptions.value = { ...matchingOptions.value, ...newOptions };
    saveLocalAdvancedPreferences(matchingOptions.value);

    // Automatically save preferences to Supabase
    try {
      await saveUserPreferences();
    } catch (error) {
      console.warn('Failed to auto-save user preferences:', error);
      // Continue without throwing to avoid breaking the UI
    }
  }

  async function resetOptions(): Promise<void> {
    try {
      const resetPrefs = await preferencesApi.resetUserPreferences();
      matchingOptions.value = { ...defaultOptions, ...resetPrefs.matchingOptions };
      saveLocalAdvancedPreferences(matchingOptions.value);
    } catch (error) {
      console.error('Error resetting preferences:', error);
      // Fall back to local defaults if reset fails
      matchingOptions.value = { ...defaultOptions };
      saveLocalAdvancedPreferences(matchingOptions.value);
    }
  }

  function validateOptions(): { valid: boolean; errors: string[]; warnings: string[] } {
    const playerStore = usePlayerStore();
    const errors: string[] = [];
    const warnings: string[] = [];
    const selectedPlayersValue = playerStore.selectedPlayers;

    // Check minimum players for at least one court
    if (selectedPlayersValue.length < 4) {
      errors.push('Need at least 4 selected players');
    } else {
      const maxCourts = Math.floor(selectedPlayersValue.length / 4);
      if (maxCourts < matchingOptions.value.numberOfCourts) {
        warnings.push(
          `Not enough players for ${matchingOptions.value.numberOfCourts} courts. ` +
            `Will use ${maxCourts} court${maxCourts > 1 ? 's' : ''} instead.`
        );
      }
    }

    // Check maximum players (allowing up to 4 to sit out per round)
    const maxPlayers = matchingOptions.value.numberOfCourts * 4 + 4;
    if (selectedPlayersValue.length > maxPlayers) {
      errors.push(`Too many players for ${matchingOptions.value.numberOfCourts} courts. Maximum ${maxPlayers} players`);
    }

    // Check court count
    if (matchingOptions.value.numberOfCourts < 1 || matchingOptions.value.numberOfCourts > 4) {
      errors.push('Number of courts must be between 1 and 4');
    }

    // Check round count
    if (matchingOptions.value.numberOfRounds < 1 || matchingOptions.value.numberOfRounds > 15) {
      errors.push('Number of rounds must be between 1 and 15');
    }

    // Check skill difference
    if (matchingOptions.value.maxSkillDifference < 0 || matchingOptions.value.maxSkillDifference > 8) {
      errors.push('Maximum skill difference must be between 0 and 8');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  function calculateAverageSkillDifference(schedule: GameSchedule): number {
    const allGames = schedule.rounds.flat();
    if (allGames.length === 0) {
      return 0;
    }

    const totalDifference = allGames.reduce((sum, game) => sum + game.skillDifference, 0);
    return Math.round((totalDifference / allGames.length) * 100) / 100;
  }

  function clearSchedule(): void {
    currentSchedule.value = null;
  }

  function pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function countDuplicatePartnerOccurrences(schedule: GameSchedule): number {
    const pairCounts: Record<string, number> = {};
    for (const round of schedule.rounds) {
      for (const game of round) {
        const k1 = pairKey(game.team1[0], game.team1[1]);
        const k2 = pairKey(game.team2[0], game.team2[1]);
        pairCounts[k1] = (pairCounts[k1] || 0) + 1;
        pairCounts[k2] = (pairCounts[k2] || 0) + 1;
      }
    }
    return Object.values(pairCounts).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  }

  function countDuplicateOpponentOccurrences(schedule: GameSchedule): number {
    const pairCounts = buildOpponentPairCounts(schedule);
    return Object.values(pairCounts).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  }

  function buildOpponentPairCounts(schedule: GameSchedule): Record<string, number> {
    const pairCounts: Record<string, number> = {};
    for (const round of schedule.rounds) {
      for (const game of round) {
        for (const p1 of game.team1) {
          for (const p2 of game.team2) {
            const key = pairKey(p1, p2);
            pairCounts[key] = (pairCounts[key] || 0) + 1;
          }
        }
      }
    }
    return pairCounts;
  }

  function calculateMaxOpponentRepeats(schedule: GameSchedule): number {
    const pairCounts = buildOpponentPairCounts(schedule);
    return Object.values(pairCounts).reduce((maxCount, count) => Math.max(maxCount, count), 0);
  }

  function calculateMaxRests(schedule: GameSchedule): number {
    const restCounts: Record<string, number> = {};
    for (const roundRestingPlayers of schedule.restingPlayers) {
      for (const playerId of roundRestingPlayers) {
        restCounts[playerId] = (restCounts[playerId] || 0) + 1;
      }
    }
    return Object.values(restCounts).reduce((maxCount, count) => Math.max(maxCount, count), 0);
  }

  function getGamesForRound(roundNumber: number): Game[] | null {
    if (!currentSchedule.value || roundNumber < 1 || roundNumber > currentSchedule.value.rounds.length) {
      return null;
    }
    const games = currentSchedule.value.rounds[roundNumber - 1];
    return games || null;
  }

  function getRestingPlayersForRound(roundNumber: number): string[] | null {
    if (!currentSchedule.value || roundNumber < 1 || roundNumber > currentSchedule.value.restingPlayers.length) {
      return null;
    }
    const resting = currentSchedule.value.restingPlayers[roundNumber - 1];
    return resting || null;
  }

  return {
    // State
    currentSchedule,
    matchingOptions,
    isGenerating,
    isLoadingPreferences,
    defaultOptions,

    // Getters
    scheduleStats,

    // Actions
    generateSchedule,
    loadUserPreferences,
    saveUserPreferences,
    updateOptions,
    resetOptions,
    validateOptions,
    clearSchedule,
    getGamesForRound,
    getRestingPlayersForRound
  };
});
