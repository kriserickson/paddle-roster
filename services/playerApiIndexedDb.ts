import type { IPlayerApi, ApiResponse } from '~/types/api';
import type { Player } from '~/types';

/**
 * IndexedDB implementation of the Player API
 * This will be replaced with actual API calls in the future
 */
export class PlayerApiIndexedDb implements IPlayerApi {
  private dbName = 'pickleballApp';
  private storeName = 'players';
  private version = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { success: true, message: 'IndexedDB not available on server. Skipping initialization.' };
    }
    try {
      if (this.db) {
        return { success: true, message: 'Database already initialized' };
      }

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          reject(new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create players store if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            store.createIndex('name', 'name', { unique: false });
          }
        };
      });

      return { success: true, message: 'Database initialized successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to initialize database', error: message };
    }
  }

  /**
   * Get all players from IndexedDB
   */
  async getPlayers(): Promise<ApiResponse<Player[]>> {
    if (!import.meta.client) {
      return { success: true, data: [], message: 'IndexedDB not available on server.' };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const players = await new Promise<Player[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      return {
        success: true,
        data: players,
        message: `Retrieved ${players.length} players`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to get players', error: message };
    }
  }

  /**
   * Create a new player
   */
  async createPlayer(player: Omit<Player, 'id'>): Promise<ApiResponse<Player>> {
    if (!import.meta.client) {
      return { success: false, message: 'Cannot create player on server.' };
    }
    try {
      await this.ensureInitialized();

      const newPlayer: Player = {
        ...player,
        id: crypto.randomUUID()
      };

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.add(newPlayer);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        success: true,
        data: newPlayer,
        message: `Player ${newPlayer.name} created successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to create player', error: message };
    }
  }

  /**
   * Update an existing player
   */
  async updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<ApiResponse<Player>> {
    if (!import.meta.client) {
      return { success: false, message: 'Cannot update player on server.' };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Get existing player
      const existingPlayer = await new Promise<Player>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            reject(new Error('Player not found'));
          }
        };
        request.onerror = () => reject(request.error);
      });

      // Update player
      const updatedPlayer: Player = { ...existingPlayer, ...updates };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(updatedPlayer);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        success: true,
        data: updatedPlayer,
        message: `Player ${updatedPlayer.name} updated successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to update player', error: message };
    }
  }

  /**
   * Delete a player
   */
  async deletePlayer(id: string): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { success: false, message: 'Cannot delete player on server.' };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        success: true,
        message: 'Player deleted successfully'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to delete player', error: message };
    }
  }

  /**
   * Bulk import players
   */
  async importPlayers(players: Player[]): Promise<ApiResponse<Player[]>> {
    if (!import.meta.client) {
      return { success: false, message: 'Cannot import players on server.' };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Add all players
      for (const player of players) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(player); // Use put to allow overwriting
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return {
        success: true,
        data: players,
        message: `Imported ${players.length} players successfully`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to import players', error: message };
    }
  }

  /**
   * Clear all players
   */
  async clearAllPlayers(): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { success: false, message: 'Cannot clear all players on server.' };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        success: true,
        message: 'All players cleared successfully'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: 'Failed to clear players', error: message };
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      const result = await this.initialize();
      // Only throw an error if initialization fails on the client
      if (!result.success && import.meta.client) {
        throw new Error(result.error || result.message);
      }
    }
  }
}
