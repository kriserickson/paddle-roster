import type { Player } from '~/types';

/**
 * Composable for managing player selection state
 */
export const usePlayerSelection = () => {
  const { players } = usePlayerManager();

  /**
   * Set of selected player IDs
   */
  const selectedPlayerIds = ref<Set<string>>(new Set());

  /**
   * Computed property for selected players
   */
  const selectedPlayers = computed(() => players.value.filter(p => selectedPlayerIds.value.has(p.id)));

  /**
   * Toggle player selection
   */
  function togglePlayerSelection(playerId: string): void {
    if (selectedPlayerIds.value.has(playerId)) {
      selectedPlayerIds.value.delete(playerId);
    } else {
      selectedPlayerIds.value.add(playerId);
    }
  }

  /**
   * Select all players
   */
  function selectAllPlayers(): void {
    selectedPlayerIds.value = new Set(players.value.map(p => p.id));
  }

  /**
   * Deselect all players
   */
  function deselectAllPlayers(): void {
    selectedPlayerIds.value.clear();
  }

  /**
   * Check if player is selected
   */
  function isPlayerSelected(playerId: string): boolean {
    return selectedPlayerIds.value.has(playerId);
  }

  /**
   * Get a player by ID
   */
  function getPlayer(id: string): Player | undefined {
    return players.value.find(p => p.id === id);
  }

  return {
    selectedPlayerIds: readonly(selectedPlayerIds),
    selectedPlayers,
    togglePlayerSelection,
    selectAllPlayers,
    deselectAllPlayers,
    isPlayerSelected,
    getPlayer
  };
};
