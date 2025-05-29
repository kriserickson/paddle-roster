import { defineStore } from 'pinia';
import { container } from 'tsyringe';
import type { Player } from '~/types';
import type { IPlayerApi } from '~/types/api';
import { TOKENS } from '~/types/api';

export const usePlayerStore = defineStore('player', () => {
  // Get API instance from DI container
  const playerApi = container.resolve<IPlayerApi>(TOKENS.PlayerApi);

  /**
   * State: List of all players
   */
  const players = ref<Player[]>([]);

  /**
   * Getters: Computed properties
   */
  const activePlayers = computed(() => players.value.filter(p => p.active));
  
  function getPlayer(id: string): Player | undefined {
    return players.value.find(p => p.id === id);
  }

  function getAvailablePartners(currentPlayerId: string): Player[] {
    return players.value.filter(p => p.id !== currentPlayerId && p.active);
  }

  function canGenerateGames(numberOfCourts: number): { valid: boolean; message?: string } {
    const activePlayersList = activePlayers.value;
    const minPlayers = numberOfCourts * 4; // 4 players per court
    const maxPlayers = numberOfCourts * 4 + 4; // Allow up to 4 to sit out

    if (activePlayersList.length < minPlayers) {
      return {
        valid: false,
        message: `Need at least ${minPlayers} active players for ${numberOfCourts} court(s). Currently have ${activePlayersList.length}.`
      };
    }

    if (activePlayersList.length > maxPlayers) {
      return {
        valid: false,
        message: `Too many players for ${numberOfCourts} court(s). Maximum ${maxPlayers} players, currently have ${activePlayersList.length}.`
      };
    }

    return { valid: true };
  }

  async function initializeStore(): Promise<{ success: boolean; message: string }> {
    const initResult = await playerApi.initialize();
    if (!initResult.success) {
      return initResult;
    } else {
      return await loadPlayers();
    }
  }

  /**
   * Initialize store by loading saved data from API
   */
  async function loadPlayers(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await playerApi.getPlayers();
      if (result.success && result.data) {
        players.value = result.data;
        return { success: true, message: `Loaded ${result.data.length} players` };
      }
      
      return { success: true, message: 'No saved players found' };
    } catch (error) {
      console.error('Error loading players:', error);
      return { 
        success: false, 
        message: 'Failed to load players' 
      };
    }
  }

  /**
   * Add a new player with automatic persistence
   */
  async function addPlayer(name: string, skillLevel: number, partnerId?: string): Promise<Player | null> {
    try {
      const result = await playerApi.createPlayer({
        name: name.trim(),
        skillLevel: Math.max(1, Math.min(5, skillLevel)), // Clamp between 1-5
        partnerId,
        active: true
      });

      if (result.success && result.data) {
        players.value.push(result.data);
        return result.data;
      }
      
      throw new Error(result.message);
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
          players.value[index] = result.data;
        }
        return true;
      }
      
      throw new Error(result.message);
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
        const index = players.value.findIndex(p => p.id === id);
        if (index !== -1) {
          players.value.splice(index, 1);
        }
        return true;
      }
      
      throw new Error(result.message);
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
      
      throw new Error(result.message);
    } catch (error) {
      console.error('Error clearing players:', error);
      return false;
    }
  }

  /**
   * Import players with validation and persistence
   */
  async function importPlayers(playersData: Player[]): Promise<{ success: boolean; message: string }> {
    try {
      // Validate the imported data
      if (!Array.isArray(playersData)) {
        return { success: false, message: 'Invalid data format' };
      }

      const validPlayers: Player[] = [];
      
      for (const playerData of playersData) {
        if (playerData.name && 
            typeof playerData.skillLevel === 'number' && 
            playerData.skillLevel >= 1 && 
            playerData.skillLevel <= 5) {
          validPlayers.push({
            id: playerData.id || crypto.randomUUID(),
            name: playerData.name.trim(),
            skillLevel: Math.max(1, Math.min(5, playerData.skillLevel)),
            partnerId: undefined, // Reset partner references on import
            active: playerData.active ?? true
          });
        }
      }

      if (validPlayers.length === 0) {
        return { success: false, message: 'No valid players found in import data' };
      }

      const result = await playerApi.importPlayers(validPlayers);
      
      if (result.success && result.data) {
        // Refresh local state
        const refreshResult = await playerApi.getPlayers();
        if (refreshResult.success && refreshResult.data) {
          players.value = refreshResult.data;
        }
        
        return { 
          success: true, 
          message: `Successfully imported ${validPlayers.length} players` 
        };
      }
      
      throw new Error(result.message);
    } catch (error) {
      console.error('Error importing players:', error);
      return { 
        success: false, 
        message: 'Error importing players: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Export players as JSON string
   */
  function exportPlayers(): string {
    return JSON.stringify(players.value, null, 2);
  }

  return {
    // State
    players: readonly(players),
    
    // Getters
    activePlayers,
    getPlayer,
    getAvailablePartners,
    canGenerateGames,
    
    // Actions
    initializeStore,
    loadPlayers,
    addPlayer,
    updatePlayer,
    removePlayer,
    clearAllPlayers,
    importPlayers,
    exportPlayers
  };
});
