// Test setup file
import { vi } from 'vitest';

// Mock LocalStorage for tests
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    clear: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn()
  },
  writable: true
});

// Mock IndexedDB for tests
const mockIDBRequest = {
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  error: null,
  onerror: null,
  onsuccess: null,
  readyState: 'done',
  removeEventListener: vi.fn(),
  result: null
};

const _mockIDBDatabase = {
  addEventListener: vi.fn(),
  close: vi.fn(),
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn(),
  dispatchEvent: vi.fn(),
  name: 'test-db',
  objectStoreNames: [],
  removeEventListener: vi.fn(),
  transaction: vi.fn(),
  version: 1
};

const mockIDBFactory = {
  cmp: vi.fn(),
  databases: vi.fn(() => Promise.resolve([])),
  deleteDatabase: vi.fn(() => mockIDBRequest),
  open: vi.fn(() => mockIDBRequest)
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: mockIDBFactory,
  writable: true
});

// Mock Nuxt composables
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $container: {
      resolve: vi.fn()
    }
  })
}));

// Mock the player store to prevent database initialization
vi.mock('~/stores/usePlayerStore', () => ({
  usePlayerStore: () => ({
    addPlayer: vi.fn(),
    deselectAllPlayers: vi.fn(),
    isPlayerSelected: vi.fn(),
    players: [],
    removePlayer: vi.fn(),
    selectAllPlayers: vi.fn(),
    selectedPlayerIds: new Set(),
    selectedPlayers: [],
    togglePlayerSelection: vi.fn(),
    updatePlayer: vi.fn()
  })
}));
