import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { container } from 'tsyringe';
import { TOKENS, type IPlayerApi } from '~/types/api';
import type { Player } from '~/types';

export const usePlayerStore = defineStore('player', () => {
  // Get API instance from DI container
  const playerApi = container.resolve<IPlayerApi>(TOKENS.PlayerApi);

  /**
   * State: List of all players
   */
  const players = ref<Player[]>([]);

  /**
   * State: Selected players for game generation
   */
  const selectedPlayerIds = ref<Set<string>>(new Set());

  /**
   * Getters: Computed properties
   */
  const selectedPlayers = computed(() => players.value.filter(p => selectedPlayerIds.value.has(p.id)));

  function getPlayer(id: string): Player | undefined {
    return players.value.find(p => p.id === id);
  }

  function getAvailablePartners(currentPlayerId: string): Player[] {
    return players.value.filter(p => p.id !== currentPlayerId);
  }

  function canGenerateGames(numberOfCourts: number): { valid: boolean; message?: string } {
    const selectedPlayersList = selectedPlayers.value;
    const minPlayers = numberOfCourts * 4; // 4 players per court
    const maxPlayers = numberOfCourts * 4 + 4; // Allow up to 4 to sit out

    if (selectedPlayersList.length < minPlayers) {
      return {
        valid: false,
        message: `Need at least ${minPlayers} selected players for ${numberOfCourts} court(s). Currently have ${selectedPlayersList.length}.`
      };
    }

    if (selectedPlayersList.length > maxPlayers) {
      return {
        valid: false,
        message: `Too many players for ${numberOfCourts} court(s). Maximum ${maxPlayers} players, currently have ${selectedPlayersList.length}.`
      };
    }

    return { valid: true };
  }

  async function initializeStore(): Promise<{ success: boolean; message: string }> {
    console.log('PlayerStore: initializeStore() starting...');
    const initResult = await playerApi.initialize();
    console.log('PlayerStore: API initialize result:', initResult);
    if (!initResult.success) {
      return initResult;
    } else {
      console.log('PlayerStore: API initialized successfully, now loading players...');
      return await loadPlayers();
    }
  }

  /**
   * Initialize store by loading saved data from API
   */
  async function loadPlayers(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('PlayerStore: loadPlayers() starting...');
      console.log('PlayerStore: calling playerApi.getPlayers()...');
      const result = await playerApi.getPlayers();
      console.log('PlayerStore: API result:', result);
      
      if (result.success && result.data) {
        players.value = result.data;
        console.log(`PlayerStore: Successfully loaded ${result.data.length} players:`, result.data.map(p => p.name));
        return { success: true, message: `Loaded ${result.data.length} players` };
      }
      players.value = []; // Ensure it's reset if no data
      console.log('PlayerStore: No players found in API response');
      return { success: true, message: 'No saved players found' };
    } catch (error) {
      console.error('PlayerStore: Error loading players:', error);
      return {
        success: false,
        message: 'Failed to load players'
      };
    }
  }
  /**
   * Selection management functions
   */
  function togglePlayerSelection(playerId: string): void {
    if (selectedPlayerIds.value.has(playerId)) {
      selectedPlayerIds.value.delete(playerId);
    } else {
      selectedPlayerIds.value.add(playerId);
    }
  }

  function selectAllPlayers(): void {
    selectedPlayerIds.value = new Set(players.value.map(p => p.id));
  }

  function deselectAllPlayers(): void {
    selectedPlayerIds.value.clear();
  }

  function isPlayerSelected(playerId: string): boolean {
    return selectedPlayerIds.value.has(playerId);
  }

  /**
   * Add a new player with automatic persistence
   */
  async function addPlayer(name: string, skillLevel: number, partnerId?: string): Promise<Player | null> {
    try {
      const result = await playerApi.createPlayer({
        name: name.trim(),
        skillLevel: Math.max(1, Math.min(5, skillLevel)), // Clamp between 1-5
        partnerId
      });

      if (result.success && result.data) {
        players.value.push(result.data);
        return result.data;
      }

      throw new Error(result.message || 'Failed to add player');
    } catch (error) {
      console.error('Error adding player:', error);
      return null;
    }
  }

  /**
   * Update a player with automatic persistence
   */
  async function updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<boolean> {
    try {
      // Validate skill level if being updated
      if (updates.skillLevel !== undefined) {
        updates.skillLevel = Math.max(1, Math.min(5, updates.skillLevel));
      }

      // Trim name if being updated
      if (updates.name !== undefined) {
        updates.name = updates.name.trim();
      }

      const result = await playerApi.updatePlayer(id, updates);

      if (result.success && result.data) {
        const index = players.value.findIndex(p => p.id === id);
        if (index !== -1) {
          players.value[index] = { ...players.value[index], ...result.data };
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  }

  /**
   * Remove a player with automatic persistence
   */
  async function removePlayer(id: string): Promise<boolean> {
    try {
      // Handle partner relationships before deletion
      const playerToDelete = players.value.find(p => p.id === id);
      if (playerToDelete?.partnerId) {
        await updatePlayer(playerToDelete.partnerId, { partnerId: undefined });
      }

      // Remove partnerships pointing to this player
      const partneredPlayers = players.value.filter(p => p.partnerId === id);
      for (const player of partneredPlayers) {
        await updatePlayer(player.id, { partnerId: undefined });
      }

      const result = await playerApi.deletePlayer(id);
      if (result.success) {
        players.value = players.value.filter(p => p.id !== id);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing player:', error);
      return false;
    }
  }

  /**
   * Clear all players with automatic persistence
   */
  async function clearAllPlayers(): Promise<boolean> {
    try {
      const result = await playerApi.clearAllPlayers();

      if (result.success) {
        players.value = [];
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing all players:', error);
      return false;
    }
  }

  /**
   * Import players with validation and persistence
   */
  async function importPlayers(playersData: Player[]): Promise<{ success: boolean; message: string }> {
    try {
      const validPlayers = playersData.filter(
        p => p.name && typeof p.skillLevel === 'number' && p.skillLevel >= 1 && p.skillLevel <= 5
      );

      const result = await playerApi.importPlayers(validPlayers);
      if (result.success && result.data) {
        // Assuming importPlayers from API returns the full list or successfully imported ones
        // For simplicity, let's reload all players after import, or merge carefully
        await loadPlayers();
        return { success: true, message: `Imported ${result.data.length} players.` };
      }
      return { success: false, message: result.message || 'Failed to import players' };
    } catch (error) {
      console.error('Error importing players:', error);
      return {
        success: false,
        message: 'Error importing players: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  initializeStore();

  /**
   * Export players as JSON string
   */
  function exportPlayers(): string {
    return JSON.stringify(players.value, null, 2);
  }
  return {
    // State: Expose the ref directly, or use a computed for readonly access
    // Option 1: Expose ref directly (actions within store modify it)
    players,
    selectedPlayerIds,
    // Option 2 (Safer for consumers): Expose a readonly computed property
    // allPlayers: computed(() => players.value),
    // And keep the internal 'players' ref for modifications within actions.
    // If choosing Option 2, components would use 'store.allPlayers'.
    // For this fix, let's try Option 1 first to directly address the error.

    // Getters
    selectedPlayers,
    getPlayer,
    getAvailablePartners,
    canGenerateGames,

    // Selection management
    togglePlayerSelection,
    selectAllPlayers,
    deselectAllPlayers,
    isPlayerSelected,

    // Actions    
    loadPlayers,
    addPlayer,
    updatePlayer,
    removePlayer,
    clearAllPlayers,
    importPlayers,
    exportPlayers
  };
});
