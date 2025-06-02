import { injectable } from 'tsyringe';
import type { Player } from '~/types';
import type { Database, PlayerRow, PlayerInsert, PlayerUpdate } from '~/types/database';
import type { IPlayerApi, ApiResponse } from '~/types/api';

/**
 * Supabase service for player management
 * Handles CRUD operations for players using Supabase as the backend
 */
@injectable()
export class PlayerApiSupabase implements IPlayerApi {
  private supabase = useSupabaseClient<Database>();
  private user = useSupabaseUser();

  /**
   * Convert database row to Player interface
   */
  private mapRowToPlayer(row: PlayerRow): Player {
    return {
      id: row.id,
      name: row.name,
      skillLevel: row.skill_level,
      partnerId: row.partner_id || undefined,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Convert Player to database insert format
   */
  private mapPlayerToInsert(player: Omit<Player, 'id'>): PlayerInsert {
    return {
      user_id: this.user.value?.id || '',
      name: player.name,
      skill_level: player.skillLevel,
      partner_id: player.partnerId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Convert Player to database update format
   */
  private mapPlayerToUpdate(player: Player): PlayerUpdate {
    return {
      name: player.name,
      skill_level: player.skillLevel,
      partner_id: player.partnerId || null,
      updated_at: new Date().toISOString()
    };
  } /**
   * Initialize the API (setup database connection, etc.)
   */
  async initialize(): Promise<ApiResponse> {
    // Supabase initialization is handled by Nuxt module
    return { success: true, message: 'Supabase API initialized' };
  }

  /**
   * Load all players for the current user
   */
  async getPlayers(): Promise<ApiResponse<Player[]>> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      const { data, error } = await this.supabase
        .from('players')
        .select('*')
        .eq('user_id', this.user.value.id)
        .order('name');

      if (error) {
        return { success: false, message: 'Failed to load players', error: error.message };
      }

      const players = (data || []).map(row => this.mapRowToPlayer(row));
      return {
        success: true,
        data: players,
        message: `Retrieved ${players.length} players`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading players:', error);
      return { success: false, message: 'Failed to load players', error: message };
    }
  }

  /**
   * Legacy method to maintain backwards compatibility
   */
  async loadPlayers(): Promise<Player[]> {
    const result = await this.getPlayers();
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
    return result.data || [];
  } /**
   * Save a player (create or update)
   */
  async savePlayer(player: Player): Promise<Player> {
    const result = await this.updatePlayer(player.id, player);
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
    return result.data!;
  }

  /**
   * Create a new player
   */
  async createPlayer(player: Omit<Player, 'id'>): Promise<ApiResponse<Player>> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      const insertData = this.mapPlayerToInsert(player);
      const { data, error } = await this.supabase.from('players').insert([insertData]).select().single();

      if (error) {
        return { success: false, message: 'Failed to create player', error: error.message };
      }

      const newPlayer = this.mapRowToPlayer(data);
      return {
        success: true,
        data: newPlayer,
        message: `Player ${newPlayer.name} created successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating player:', error);
      return { success: false, message: 'Failed to create player', error: message };
    }
  }

  /**
   * Update an existing player
   */
  async updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<ApiResponse<Player>> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      if (!id || id === '') {
        // This is a new player, create it
        return await this.createPlayer(updates as Omit<Player, 'id'>);
      }

      const updateData = this.mapPlayerToUpdate({ id, ...updates } as Player);
      const { data, error } = await this.supabase
        .from('players')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', this.user.value.id)
        .select()
        .single();

      if (error) {
        return { success: false, message: 'Failed to update player', error: error.message };
      }

      const updatedPlayer = this.mapRowToPlayer(data);
      return {
        success: true,
        data: updatedPlayer,
        message: `Player ${updatedPlayer.name} updated successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating player:', error);
      return { success: false, message: 'Failed to update player', error: message };
    }
  }
  /**
   * Delete a player
   */
  async deletePlayer(id: string): Promise<ApiResponse> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      const { error } = await this.supabase.from('players').delete().eq('id', id).eq('user_id', this.user.value.id);

      if (error) {
        return { success: false, message: 'Failed to delete player', error: error.message };
      }

      return { success: true, message: 'Player deleted successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting player:', error);
      return { success: false, message: 'Failed to delete player', error: message };
    }
  }
  /**
   * Bulk import players
   */
  async importPlayers(players: Player[]): Promise<ApiResponse<Player[]>> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      const insertData = players.map(player => this.mapPlayerToInsert(player));
      const { data, error } = await this.supabase.from('players').insert(insertData).select();

      if (error) {
        return { success: false, message: 'Failed to import players', error: error.message };
      }

      const importedPlayers = (data || []).map(row => this.mapRowToPlayer(row));
      return {
        success: true,
        data: importedPlayers,
        message: `Imported ${importedPlayers.length} players successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error importing players:', error);
      return { success: false, message: 'Failed to import players', error: message };
    }
  }

  /**
   * Clear all players for the current user
   */
  async clearAllPlayers(): Promise<ApiResponse> {
    try {
      if (!this.user.value) {
        return { success: false, message: 'User not authenticated' };
      }

      const { error } = await this.supabase.from('players').delete().eq('user_id', this.user.value.id);

      if (error) {
        return { success: false, message: 'Failed to clear players', error: error.message };
      }

      return { success: true, message: 'All players cleared successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error clearing players:', error);
      return { success: false, message: 'Failed to clear players', error: message };
    }
  }

  /**
   * Legacy method to maintain backwards compatibility
   */
  async clearPlayers(): Promise<void> {
    const result = await this.clearAllPlayers();
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
  }
}
