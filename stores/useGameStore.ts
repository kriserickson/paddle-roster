import { defineStore } from 'pinia';
import type { GameSchedule, MatchingOptions, Game } from '~/types';
import { PickleballMatcher } from '~/utils/pickleballMatcher';
import { UserPreferencesApiSupabase } from '~/services/userPreferencesApiSupabase';

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
    distributeRestEqually: true
  };

  const matchingOptions = ref<MatchingOptions>({ ...defaultOptions });
  const preferencesApi = new UserPreferencesApiSupabase();

  /**
   * Getters
   */
  const scheduleStats = computed(() => {
    if (!currentSchedule.value) return null;

    const schedule = currentSchedule.value;
    const totalGames = schedule.rounds.reduce((sum, round) => sum + round.length, 0);
    const totalRounds = schedule.rounds.length;
    const playersPerRound = schedule.rounds[0]?.length * 4 || 0;
    const restingPerRound = schedule.restingPlayers[0]?.length || 0;

    return {
      totalGames,
      totalRounds,
      playersPerRound,
      restingPerRound,
      averageSkillDifference: calculateAverageSkillDifference(schedule),
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

      if (selectedPlayersValue.length < matchingOptions.value.numberOfCourts * 4) {
        throw new Error(`Need at least ${matchingOptions.value.numberOfCourts * 4} selected players`);
      } // Create matcher instance
      const matcher = new PickleballMatcher(selectedPlayersValue, matchingOptions.value);

      // Generate schedule
      const schedule = matcher.generateSchedule(eventLabel);

      currentSchedule.value = schedule;
      return schedule;
    } catch (error) {
      console.error('Error generating schedule:', error);
      throw error;
    } finally {
      isGenerating.value = false;
    }
  }

  async function regenerateSchedule(): Promise<GameSchedule | null> {
    const eventLabel = currentSchedule.value?.eventLabel || '';
    return generateSchedule(eventLabel);
  }

  /**
   * Load user's saved preferences from Supabase
   */
  async function loadUserPreferences(): Promise<void> {
    try {
      isLoadingPreferences.value = true;
      const preferences = await preferencesApi.getUserPreferences();
      matchingOptions.value = preferences;
    } catch (error) {
      console.error('Error loading user preferences:', error);
      // Fall back to default options if loading fails
      matchingOptions.value = { ...defaultOptions };
    } finally {
      isLoadingPreferences.value = false;
    }
  }

  /**
   * Save current options as user's preferences
   */
  async function saveUserPreferences(): Promise<void> {
    try {
      await preferencesApi.saveUserPreferences(matchingOptions.value);
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  }

  async function updateOptions(newOptions: Partial<MatchingOptions>): Promise<void> {
    matchingOptions.value = { ...matchingOptions.value, ...newOptions };
    
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
      const resetPreferences = await preferencesApi.resetUserPreferences();
      matchingOptions.value = resetPreferences;
    } catch (error) {
      console.error('Error resetting preferences:', error);
      // Fall back to local defaults if reset fails
      matchingOptions.value = { ...defaultOptions };
    }
  }
  function validateOptions(): { valid: boolean; errors: string[] } {
    const playerStore = usePlayerStore();
    const errors: string[] = [];
    const selectedPlayersValue = playerStore.selectedPlayers;

    // Check minimum players
    const minPlayers = matchingOptions.value.numberOfCourts * 4;
    if (selectedPlayersValue.length < minPlayers) {
      errors.push(`Need at least ${minPlayers} selected players for ${matchingOptions.value.numberOfCourts} courts`);
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
      errors
    };
  }

  function calculateAverageSkillDifference(schedule: GameSchedule): number {
    const allGames = schedule.rounds.flat();
    if (allGames.length === 0) return 0;

    const totalDifference = allGames.reduce((sum, game) => sum + game.skillDifference, 0);
    return Math.round((totalDifference / allGames.length) * 100) / 100;
  }

  function exportSchedule(): string | null {
    if (!currentSchedule.value) return null;
    return JSON.stringify(currentSchedule.value, null, 2);
  }

  function importSchedule(scheduleJson: string): { success: boolean; message: string } {
    try {
      const schedule = JSON.parse(scheduleJson) as GameSchedule;

      // Basic validation
      if (!schedule.rounds || !Array.isArray(schedule.rounds)) {
        return { success: false, message: 'Invalid schedule format' };
      }

      currentSchedule.value = schedule;
      return { success: true, message: 'Schedule imported successfully' };
    } catch (error: unknown) {
      return { success: false, message: 'Error parsing schedule JSON: ' + JSON.stringify(error) };
    }
  }

  function clearSchedule(): void {
    currentSchedule.value = null;
  }

  function getGamesForRound(roundNumber: number): Game[] | null {
    if (!currentSchedule.value || roundNumber < 1 || roundNumber > currentSchedule.value.rounds.length) {
      return null;
    }
    return currentSchedule.value.rounds[roundNumber - 1];
  }

  function getRestingPlayersForRound(roundNumber: number): string[] | null {
    if (!currentSchedule.value || roundNumber < 1 || roundNumber > currentSchedule.value.restingPlayers.length) {
      return null;
    }
    return currentSchedule.value.restingPlayers[roundNumber - 1];
  }

  return {
    // State
    currentSchedule: readonly(currentSchedule),
    matchingOptions: readonly(matchingOptions),
    isGenerating: readonly(isGenerating),
    isLoadingPreferences: readonly(isLoadingPreferences),
    defaultOptions,

    // Getters
    scheduleStats,

    // Actions
    generateSchedule,
    regenerateSchedule,
    loadUserPreferences,
    saveUserPreferences,
    updateOptions,
    resetOptions,
    validateOptions,
    exportSchedule,
    importSchedule,
    clearSchedule,
    getGamesForRound,
    getRestingPlayersForRound
  };
});
