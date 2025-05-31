import type { Player } from '~/types';

/**
 * Composable for managing player data with local storage persistence
 */
export const usePlayerManager = () => {
  const STORAGE_KEY = 'pickleball-players';

  /**
   * Reactive list of all players
   */
  const players = ref<Player[]>([]);

  /**
   * Load players from local storage
   */
  const loadPlayers = (): void => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          players.value = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error loading players from localStorage:', error);
        players.value = [];
      }
    }
  };

  /**
   * Save players to local storage
   */
  const savePlayers = (): void => {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(players.value));
      } catch (error) {
        console.error('Error saving players to localStorage:', error);
      }
    }
  };

  /**
   * Add a new player
   */
  const addPlayer = (name: string, skillLevel: number, partnerId?: string): Player => {
    const newPlayer: Player = {
      id: generatePlayerId(),
      name: name.trim(),
      skillLevel: Math.max(1, Math.min(5, skillLevel)), // Clamp between 1-5
      partnerId
    };

    players.value.push(newPlayer);
    savePlayers();
    return newPlayer;
  };

  /**
   * Update an existing player
   */
  const updatePlayer = (id: string, updates: Partial<Omit<Player, 'id'>>): boolean => {
    const index = players.value.findIndex(p => p.id === id);
    if (index === -1) return false;

    // Validate skill level if being updated
    if (updates.skillLevel !== undefined) {
      updates.skillLevel = Math.max(1, Math.min(5, updates.skillLevel));
    }

    // Trim name if being updated
    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    players.value[index] = { ...players.value[index], ...updates };
    savePlayers();
    return true;
  };

  /**
   * Remove a player
   */
  const removePlayer = (id: string): boolean => {
    const index = players.value.findIndex(p => p.id === id);
    if (index === -1) return false;

    // Remove any partner references to this player
    players.value.forEach(player => {
      if (player.partnerId === id) {
        player.partnerId = undefined;
      }
    });

    players.value.splice(index, 1);
    savePlayers();
    return true;
  };

  /**
   * Get a player by ID
   */
  const getPlayer = (id: string): Player | undefined => {
    return players.value.find(p => p.id === id);
  };

  /**
   * Get players available for partner selection (excluding the current player)
   */
  const getAvailablePartners = (currentPlayerId: string): Player[] => {
    return players.value.filter(p => p.id !== currentPlayerId);
  };

  /**
   * Validate that minimum number of players exist for games
   */
  const canGenerateGames = (numberOfCourts: number): { valid: boolean; message?: string } => {
    const activePlayers = [...players.value];
    const minPlayers = numberOfCourts * 4; // 4 players per court
    const maxPlayers = numberOfCourts * 4 + 4; // Allow up to 4 to sit out

    if (activePlayers.length < minPlayers) {
      return {
        valid: false,
        message: `Need at least ${minPlayers} active players for ${numberOfCourts} court(s). Currently have ${activePlayers.length}.`
      };
    }

    if (activePlayers.length > maxPlayers) {
      return {
        valid: false,
        message: `Too many players for ${numberOfCourts} court(s). Maximum ${maxPlayers} players, currently have ${activePlayers.length}.`
      };
    }

    return { valid: true };
  };

  /**
   * Generate a unique player ID
   */
  const generatePlayerId = (): string => {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Clear all players (with confirmation)
   */
  const clearAllPlayers = (): void => {
    players.value = [];
    savePlayers();
  };

  /**
   * Import players from JSON
   */
  const importPlayers = (playersData: Player[]): { success: boolean; message: string } => {
    try {
      // Validate the imported data
      if (!Array.isArray(playersData)) {
        return { success: false, message: 'Invalid data format' };
      }

      const validPlayers = playersData.filter(p => 
        p.name && 
        typeof p.skillLevel === 'number' && 
        p.skillLevel >= 1 && 
        p.skillLevel <= 5
      );

      if (validPlayers.length === 0) {
        return { success: false, message: 'No valid players found in import data' };
      }

      // Generate new IDs and ensure proper structure
      const importedPlayers: Player[] = validPlayers.map(p => ({
        id: generatePlayerId(),
        name: p.name.trim(),
        skillLevel: Math.max(1, Math.min(5, p.skillLevel)),
        partnerId: undefined
      }));

      players.value = [...players.value, ...importedPlayers];
      savePlayers();

      return { 
        success: true, 
        message: `Successfully imported ${importedPlayers.length} players` 
      };
    } catch (error) {
      return { success: false, message: 'Error importing players: ' + JSON.stringify(error) };
    }
  };

  /**
   * Export players to JSON
   */
  const exportPlayers = (): string => {
    return JSON.stringify(players.value, null, 2);
  };

  // Load players on composable initialization
  onMounted(() => {
    loadPlayers();
  });

  // Watch for changes and auto-save
  watch(players, savePlayers, { deep: true });

  return {
    players: readonly(players),
    addPlayer,
    updatePlayer,
    removePlayer,
    getPlayer,
    getAvailablePartners,
    canGenerateGames,
    clearAllPlayers,
    importPlayers,
    exportPlayers,
    loadPlayers
  };
};
