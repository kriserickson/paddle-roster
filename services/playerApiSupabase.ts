import type { Player } from '~/types';
import type { ApiResponse, IPlayerApi } from '~/types/api';
import type { Database, PlayerInsert, PlayerRow, PlayerUpdate } from '~/types/database.types';

/**
 * Supabase service for player management
 * Handles CRUD operations for players using Supabase as the backend
 */
export class PlayerApiSupabase implements IPlayerApi {
  private supabase = useSupabaseClient<Database>();
  private userId: string | null;

  public constructor() {
    const user = useSupabaseUser();
    this.userId = user.value?.id || user.value?.sub || null;
  }

  /**
   * Convert database row to Player interface
   */
  private mapRowToPlayer(row: PlayerRow): Player {
    return {
      id: row.id,
      name: row.name,
      skillLevel: row.skill_level,
      partnerId: row.partner_id || undefined
      // createdAt: row.created_at,
      // updatedAt: row.updated_at,
      // userId: row.user_id
    };
  }

  /**
   * Convert Player to database insert format
   */
  private mapPlayerToInsert(player: Omit<Player, 'id'>): Omit<PlayerInsert, 'id'> {
    if (!this.userId) {
      throw new Error('User must be authenticated to create players');
    }
    return {
      created_at: new Date().toISOString(),
      name: player.name,
      partner_id: player.partnerId || null,
      skill_level: player.skillLevel,
      updated_at: new Date().toISOString(),
      user_id: this.userId
    };
  }

  /**
   * Convert Player to database update format
   */
  private mapPlayerToUpdate(player: Player): PlayerUpdate {
    return {
      name: player.name,
      partner_id: player.partnerId || null,
      skill_level: player.skillLevel,
      updated_at: new Date().toISOString()
    };
  } /**
   * Initialize the API (setup database connection, etc.)
   */
  public async initialize(): Promise<ApiResponse> {
    // Supabase initialization is handled by Nuxt module
    return { message: 'Supabase API initialized', success: true };
  }

  /**
   * Load all players for the current user
   */
  public async getPlayers(): Promise<ApiResponse<Player[]>> {
    try {
      //console.log('PlayerApiSupabase: Starting getPlayers...');

      let query = this.supabase.from('players').select('*');

      // If user is authenticated, filter by user_id
      if (this.userId) {
        //console.log('User authenticated, filtering by user_id:', this.user.value.id);
        query = query.eq('user_id', this.userId);
      } else {
        console.error('User not authenticated, loading all players for data recovery');
      }
      // If not authenticated, load all players (temporary for data recovery)

      //console.log('Executing Supabase query...');
      const { data, error } = await query.order('name');

      //console.log('Supabase query response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        return { error: error.message, message: 'Failed to load players', success: false };
      }

      //console.log('Raw data from Supabase:', data);
      const players = (data || []).map(row => this.mapRowToPlayer(row));
      //console.log('Mapped players:', players);

      return {
        data: players,
        message: `Retrieved ${players.length} players`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading players:', error);
      return { error: message, message: 'Failed to load players', success: false };
    }
  }

  /**
   * Legacy method to maintain backwards compatibility
   */
  public async loadPlayers(): Promise<Player[]> {
    const result = await this.getPlayers();
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
    return result.data || [];
  } /**
   * Save a player (create or update)
   */
  public async savePlayer(player: Player): Promise<Player> {
    const result = await this.updatePlayer(player.id, player);
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
    return result.data || player; // Fallback to original player if data is missing
  }

  /**
   * Create a new player
   */
  public async createPlayer(player: Omit<Player, 'id'>): Promise<ApiResponse<Player>> {
    try {
      // User must be authenticated to create players (user_id is a required UUID field)
      const insertData = this.mapPlayerToInsert(player);

      // @ts-expect-error: Supabase generic type inference limitation in VS Code
      const { data, error } = await this.supabase.from('players').insert([insertData]).select().single();

      if (error) {
        return { error: error.message, message: 'Failed to create player', success: false };
      }

      const newPlayer = this.mapRowToPlayer(data);
      return {
        data: newPlayer,
        message: `Player ${newPlayer.name} created successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating player:', error);
      return { error: message, message: 'Failed to create player', success: false };
    }
  }

  /**
   * Update an existing player
   */
  public async updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<ApiResponse<Player>> {
    try {
      // Allow updating players even without authentication (temporary for data recovery)
      if (!id || id === '') {
        // This is a new player, create it
        return await this.createPlayer(updates as Omit<Player, 'id'>);
      }

      const updateData = this.mapPlayerToUpdate({ id, ...updates } as Player);

      // @ts-expect-error: Supabase generic type inference limitation in VS Code
      let query = this.supabase.from('players').update(updateData).eq('id', id);

      // If user is authenticated, also filter by user_id
      if (this.userId) {
        query = query.eq('user_id', this.userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        return { error: error.message, message: 'Failed to update player', success: false };
      }

      const updatedPlayer = this.mapRowToPlayer(data);
      return {
        data: updatedPlayer,
        message: `Player ${updatedPlayer.name} updated successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating player:', error);
      return { error: message, message: 'Failed to update player', success: false };
    }
  }
  /**
   * Delete a player
   */
  public async deletePlayer(id: string): Promise<ApiResponse> {
    try {
      // Allow deleting players even without authentication (temporary for data recovery)
      let query = this.supabase.from('players').delete().eq('id', id);

      // If user is authenticated, also filter by user_id
      if (this.userId) {
        query = query.eq('user_id', this.userId);
      }

      const { error } = await query;

      if (error) {
        return { error: error.message, message: 'Failed to delete player', success: false };
      }

      return { message: 'Player deleted successfully', success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting player:', error);
      return { error: message, message: 'Failed to delete player', success: false };
    }
  }
  /**
   * Bulk import players
   */
  public async importPlayers(players: Player[]): Promise<ApiResponse<Player[]>> {
    try {
      if (!this.userId) {
        return { message: 'User not authenticated', success: false };
      }

      const insertData = players.map(player => this.mapPlayerToInsert(player));

      // @ts-expect-error: Supabase generic type inference limitation in VS Code
      const { data, error } = await this.supabase.from('players').insert(insertData).select();

      if (error) {
        return { error: error.message, message: 'Failed to import players', success: false };
      }

      const importedPlayers = (data || []).map(row => this.mapRowToPlayer(row));
      return {
        data: importedPlayers,
        message: `Imported ${importedPlayers.length} players successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error importing players:', error);
      return { error: message, message: 'Failed to import players', success: false };
    }
  }

  /**
   * Clear all players for the current user
   */
  public async clearAllPlayers(): Promise<ApiResponse> {
    try {
      if (!this.userId) {
        return { message: 'User not authenticated', success: false };
      }

      const { error } = await this.supabase.from('players').delete().eq('user_id', this.userId);

      if (error) {
        return { error: error.message, message: 'Failed to clear players', success: false };
      }

      return { message: 'All players cleared successfully', success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error clearing players:', error);
      return { error: message, message: 'Failed to clear players', success: false };
    }
  }

  /**
   * Legacy method to maintain backwards compatibility
   */
  public async clearPlayers(): Promise<void> {
    const result = await this.clearAllPlayers();
    if (!result.success) {
      throw new Error(result.error || result.message);
    }
  }
}
