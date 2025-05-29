import type { Player } from '~/types';

/**
 * API response wrapper
 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

/**
 * Player API interface for dependency injection
 */
export interface IPlayerApi {
  /**
   * Initialize the API (setup database connection, etc.)
   */
  initialize(): Promise<ApiResponse>;

  /**
   * Get all players
   */
  getPlayers(): Promise<ApiResponse<Player[]>>;

  /**
   * Create a new player
   */
  createPlayer(player: Omit<Player, 'id'>): Promise<ApiResponse<Player>>;

  /**
   * Update an existing player
   */
  updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<ApiResponse<Player>>;

  /**
   * Delete a player
   */
  deletePlayer(id: string): Promise<ApiResponse>;

  /**
   * Bulk import players
   */
  importPlayers(players: Player[]): Promise<ApiResponse<Player[]>>;

  /**
   * Clear all players
   */
  clearAllPlayers(): Promise<ApiResponse>;
}

/**
 * Dependency injection tokens
 */
export const TOKENS = {
  PlayerApi: Symbol('PlayerApi')
} as const;
