import { container } from 'tsyringe';
import type { Player } from '~/types';
import type { IPlayerApi } from '~/types/api';
import { TOKENS } from '~/types/api';

/**
 * Composable for managing player data with dependency injection
 */
export const usePlayerManager = () => {
  const playerApi = container.resolve<IPlayerApi>(TOKENS.PlayerApi);
  const user = useSupabaseUser();
  
  // Check if we're in demo mode - this is now only for UI purposes
  const config = useRuntimeConfig();
  const isDemo = computed(() => {
    return !config.public.supabase?.url || 
           !config.public.supabase?.key ||
           config.public.supabase.url === 'https://your-project.supabase.co' ||
           config.public.supabase.url.includes('placeholder');
  });

  /**
   * Reactive list of all players
   */
  const players = ref<Player[]>([]);
  
  /**
   * Loading state
   */
  const loading = ref(false);
  
  /**
   * Error state
   */
  const error = ref<string | null>(null);
  /**
   * Load players from the API
   */
  async function loadPlayers(): Promise<void> {
    try {
      loading.value = true;
      error.value = null;
      
      const result = await playerApi.getPlayers();
      if (!result.success) {
        error.value = result.error || result.message;
        players.value = [];
        return;
      }
      
      players.value = result.data || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load players';
      console.error('Error loading players:', err);
    } finally {
      loading.value = false;
    }
  }
  /**
   * Add a new player
   */
  async function addPlayer(name: string, skillLevel: number, partnerId?: string): Promise<Player | null> {
    try {
      loading.value = true;
      error.value = null;
      
      const result = await playerApi.createPlayer({
        name,
        skillLevel,
        partnerId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      if (!result.success) {
        error.value = result.error || result.message;
        return null;
      }
      
      const newPlayer = result.data!;
      players.value.push(newPlayer);
      return newPlayer;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add player';
      console.error('Error adding player:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }
  /**
   * Update an existing player
   */
  async function updatePlayer(id: string, updates: Partial<Omit<Player, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      loading.value = true;
      error.value = null;
      
      // Validate updates
      if (updates.name !== undefined) {
        updates.name = updates.name.trim();
        if (!updates.name) {
          error.value = 'Player name cannot be empty';
          return false;
        }
      }
      
      if (updates.skillLevel !== undefined) {
        updates.skillLevel = Math.max(1, Math.min(5, updates.skillLevel));
      }

      const result = await playerApi.updatePlayer(id, updates);
      if (!result.success) {
        error.value = result.error || result.message;
        return false;
      }
      
      const updatedPlayer = result.data!;
      const index = players.value.findIndex(p => p.id === id);
      if (index !== -1) {
        players.value[index] = updatedPlayer;
      }
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update player';
      console.error('Error updating player:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }
  /**
   * Remove a player
   */
  async function removePlayer(id: string): Promise<boolean> {
    try {
      loading.value = true;
      error.value = null;
      
      const result = await playerApi.deletePlayer(id);
      if (!result.success) {
        error.value = result.error || result.message;
        return false;
      }
      
      // Remove from local array
      players.value = players.value.filter(p => p.id !== id);
      
      // Remove any partner references to this player locally
      players.value.forEach(player => {
        if (player.partnerId === id) {
          player.partnerId = undefined;
        }
      });
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove player';
      console.error('Error removing player:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get a specific player by ID
   */
  function getPlayer(id: string): Player | undefined {
    return players.value.find(p => p.id === id);
  }

  /**
   * Get players with partner relationships resolved
   */
  function getPlayersWithPartners(): (Player & { partner?: Player })[] {
    return players.value.map(player => ({
      ...player,
      partner: player.partnerId ? getPlayer(player.partnerId) : undefined
    }));
  }

  /**
   * Validate that minimum number of players exist for games
   */
  function validatePlayersForGames(minPlayers = 4): { valid: boolean; message?: string } {
    const activePlayers = [...players.value];
    
    if (activePlayers.length < minPlayers) {
      return {
        valid: false,
        message: `Need at least ${minPlayers} players to generate games. Currently have ${activePlayers.length}.`
      };
    }
    
    return { valid: true };
  }
  /**
   * Import players from JSON data
   */
  async function importPlayers(playersData: any[]): Promise<{ success: boolean; message: string }> {
    try {
      loading.value = true;
      error.value = null;

      if (!Array.isArray(playersData)) {
        return { success: false, message: 'Invalid data format' };
      }

      const validPlayers = playersData.filter(p => 
        typeof p.name === 'string' && 
        typeof p.skillLevel === 'number' && 
        p.skillLevel >= 1 && 
        p.skillLevel <= 5
      );

      const result = await playerApi.importPlayers(validPlayers);
      if (!result.success) {
        return { success: false, message: result.error || result.message };
      }

      await loadPlayers();
      return { success: true, message: `Imported ${validPlayers.length} players` };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import players';
      return { success: false, message: error.value || 'Unknown error' };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get available partners for a specific player (excluding the player themselves)
   */
  function getAvailablePartners(playerId: string): Player[] {
    return players.value.filter(p => p.id !== playerId);
  }

  /**
   * Check if minimum number of players exist for generating games
   */
  const canGenerateGames = computed(() => {
    return players.value.length >= 4;
  });  /**
   * Clear all players
   */
  async function clearAllPlayers(): Promise<boolean> {
    try {
      loading.value = true;
      error.value = null;
      
      const result = await playerApi.clearAllPlayers();
      if (!result.success) {
        error.value = result.error || result.message;
        return false;
      }
      
      players.value = [];
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to clear players';
      console.error('Error clearing players:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Export players as JSON
   */
  function exportPlayers(): string {
    const exportData = players.value.map(player => ({
      name: player.name,
      skillLevel: player.skillLevel,
      partnerId: player.partnerId
    }));
    return JSON.stringify(exportData, null, 2);
  }
  // Load players when user changes or component mounts
  watch(user, (newUser) => {
    if (newUser || isDemo.value) {
      loadPlayers();
    } else {
      players.value = [];
    }
  }, { immediate: true });

  return {
    players: readonly(players),
    loading: readonly(loading),
    error: readonly(error),
    isDemo: readonly(isDemo),
    loadPlayers,
    addPlayer,
    updatePlayer,
    removePlayer,
    getPlayer,
    getPlayersWithPartners,
    validatePlayersForGames,
    importPlayers,
    getAvailablePartners,
    canGenerateGames,
    clearAllPlayers,
    exportPlayers
  };
};
