// Test setup file
import { vi } from 'vitest';

// Mock LocalStorage for tests
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock IndexedDB for tests
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,  readyState: 'done',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

const _mockIDBDatabase = {
  name: 'test-db',
  version: 1,
  objectStoreNames: [],
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

const mockIDBFactory = {
  open: vi.fn(() => mockIDBRequest),
  deleteDatabase: vi.fn(() => mockIDBRequest),
  databases: vi.fn(() => Promise.resolve([])),
  cmp: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIDBFactory,
  writable: true,
});

// Mock Nuxt composables
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $container: {
      resolve: vi.fn(),
    },
  }),
}));

// Mock the player store to prevent database initialization
vi.mock('~/stores/usePlayerStore', () => ({
  usePlayerStore: () => ({
    players: [],
    selectedPlayerIds: new Set(),
    selectedPlayers: [],
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    updatePlayer: vi.fn(),
    togglePlayerSelection: vi.fn(),
    selectAllPlayers: vi.fn(),
    deselectAllPlayers: vi.fn(),
    isPlayerSelected: vi.fn(),
  }),
}));
