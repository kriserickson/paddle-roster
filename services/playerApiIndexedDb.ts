import type { Player } from '~/types';
import type { ApiResponse, IPlayerApi } from '~/types/api';

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
  public async initialize(): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { message: 'IndexedDB not available on server. Skipping initialization.', success: true };
    }
    try {
      if (this.db) {
        return { message: 'Database already initialized', success: true };
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

      return { message: 'Database initialized successfully', success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to initialize database', success: false };
    }
  }

  /**
   * Get all players from IndexedDB
   */
  public async getPlayers(): Promise<ApiResponse<Player[]>> {
    if (!import.meta.client) {
      return { data: [], message: 'IndexedDB not available on server.', success: true };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db?.transaction([this.storeName], 'readonly');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
      const store = transaction.objectStore(this.storeName);

      const players = await new Promise<Player[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      return {
        data: players,
        message: `Retrieved ${players.length} players`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to get players', success: false };
    }
  }

  /**
   * Create a new player
   */
  public async createPlayer(player: Omit<Player, 'id'>): Promise<ApiResponse<Player>> {
    if (!import.meta.client) {
      return { message: 'Cannot create player on server.', success: false };
    }
    try {
      await this.ensureInitialized();

      const newPlayer: Player = Object.assign({}, player, {
        id: crypto.randomUUID()
      });

      const transaction = this.db?.transaction([this.storeName], 'readwrite');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.add(newPlayer);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        data: newPlayer,
        message: `Player ${newPlayer.name} created successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to create player', success: false };
    }
  }

  /**
   * Update an existing player
   */
  public async updatePlayer(id: string, updates: Partial<Omit<Player, 'id'>>): Promise<ApiResponse<Player>> {
    if (!import.meta.client) {
      return { message: 'Cannot update player on server.', success: false };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db?.transaction([this.storeName], 'readwrite');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
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
      const updatedPlayer: Player = Object.assign({}, existingPlayer, updates);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(updatedPlayer);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        data: updatedPlayer,
        message: `Player ${updatedPlayer.name} updated successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to update player', success: false };
    }
  }

  /**
   * Delete a player
   */
  public async deletePlayer(id: string): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { message: 'Cannot delete player on server.', success: false };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db?.transaction([this.storeName], 'readwrite');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        message: 'Player deleted successfully',
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to delete player', success: false };
    }
  }

  /**
   * Bulk import players
   */
  public async importPlayers(players: Player[]): Promise<ApiResponse<Player[]>> {
    if (!import.meta.client) {
      return { message: 'Cannot import players on server.', success: false };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db?.transaction([this.storeName], 'readwrite');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
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
        data: players,
        message: `Imported ${players.length} players successfully`,
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to import players', success: false };
    }
  }

  /**
   * Clear all players
   */
  public async clearAllPlayers(): Promise<ApiResponse> {
    if (!import.meta.client) {
      return { message: 'Cannot clear all players on server.', success: false };
    }
    try {
      await this.ensureInitialized();

      const transaction = this.db?.transaction([this.storeName], 'readwrite');
      if (!transaction) {
        throw new Error('Database not initialized');
      }
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return {
        message: 'All players cleared successfully',
        success: true
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message, message: 'Failed to clear players', success: false };
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
