<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { Player } from '~/types';
import AddEditPlayerModal from '~/components/modals/AddEditPlayerModal.vue';
import ImportPlayersModal from '~/components/modals/ImportPlayersModal.vue';
import DeletePlayerModal from '~/components/modals/DeletePlayerModal.vue';

// Define interfaces for CSV import
interface PlayerImportData {
  name: string;
  skillLevel: number;
  partnerName?: string;
  [key: string]: string | number | undefined; // Allow for additional fields in CSV
}

const playerStore = usePlayerStore();

const toast = useToast();

// Reactive state
const showAddPlayer = ref(false);
const showImportModal = ref(false);
const showDeleteConfirm = ref(false);
const editingPlayer = ref<Player | null>(null);
const playerToDelete = ref<Player | null>(null);
const searchQuery = ref('');
const importData = ref('');

// Player form
const playerForm = ref({
  name: '',
  skillLevel: 3.0,
  partnerId: 'none'
});

const columns: TableColumn<Player>[] = [
  {
    id: 'name',
    header: 'Name'
  },
  {
    id: 'skillLevel',
    header: 'Skill Level'
  },
  {
    id: 'partnerId',
    header: 'Partner'
  },
  {
    id: 'actions',
    header: 'Actions'
  }
];

// Computed properties
const totalPlayers = computed(() => playerStore.players.length);

const averageSkillLevel = computed(() => {
  if (playerStore.players.length === 0) {
    return '0.0';
  }
  const total = playerStore.players.reduce((sum: number, player: Player) => sum + player.skillLevel, 0);
  return (total / playerStore.players.length).toFixed(1);
});

const playersWithPartners = computed(() => {
  return playerStore.players.filter((player: Player) => player.partnerId).length;
});

const filteredPlayers = computed(() => {
  if (!searchQuery.value) {
    return playerStore.players.slice();
  }

  const query = searchQuery.value.toLowerCase();
  return playerStore.players.filter((player: Player) => player.name.toLowerCase().includes(query)).slice();
});

const partnerOptions = computed(() => {
  const currentPlayerId = editingPlayer.value?.id;
  const availablePartners = currentPlayerId ? playerStore.getAvailablePartners(currentPlayerId) : playerStore.players;

  return [
    { label: 'No Partner', value: 'none' },
    ...availablePartners.map((player: Player) => {
      return {
        label: player.name,
        value: player.id
      };
    })
  ];
});

// Methods
function getPlayerName(playerId: string): string {
  const player = playerStore.getPlayer(playerId);
  if (player) {
    return player.name;
  } else {
    return 'Unknown';
  }
}

function handleAddPlayer(): void {
  editingPlayer.value = null;
  playerForm.value = {
    name: '',
    skillLevel: 3.0,
    partnerId: 'none'
  };
  showAddPlayer.value = true;
}

function editPlayer(player: Player): void {
  editingPlayer.value = player;
  // Check if the player's current partner is still available
  const currentPartnerId = player.partnerId;
  const availablePartners = playerStore.getAvailablePartners(player.id);
  const isPartnerAvailable = currentPartnerId && availablePartners.some((p: Player) => p.id === currentPartnerId);

  playerForm.value = {
    name: player.name,
    skillLevel: player.skillLevel,
    partnerId: isPartnerAvailable ? currentPartnerId : 'none'
  };
  showAddPlayer.value = true;
}

function confirmDelete(player: Player): void {
  playerToDelete.value = player;
  showDeleteConfirm.value = true;
}

async function deletePlayer(): Promise<void> {
  //console.log('deletePlayer called with:', playerToDelete.value); // Debug log

  if (playerToDelete.value) {
    //console.log('Attempting to remove player:', playerToDelete.value.id); // Debug log

    const success = await playerStore.removePlayer(playerToDelete.value.id);

    //console.log('Remove result:', success); // Debug log

    if (success) {
      toast.add({
        title: 'Player deleted',
        description: `${playerToDelete.value.name} has been removed.`,
        color: 'success'
      });
    } else {
      toast.add({
        title: 'Error',
        description: 'Failed to delete player.',
        color: 'error'
      });
    }
  }
  showDeleteConfirm.value = false;
  playerToDelete.value = null;
}

async function savePlayer(): Promise<void> {
  try {
    const partnerIdToSave = playerForm.value.partnerId === 'none' ? undefined : playerForm.value.partnerId;
    if (editingPlayer.value) {
      const success = await playerStore.updatePlayer(editingPlayer.value.id, {
        name: playerForm.value.name,
        skillLevel: playerForm.value.skillLevel,
        partnerId: partnerIdToSave
      });

      if (success) {
        // Update partner relationship
        if (partnerIdToSave) {
          await playerStore.updatePlayer(partnerIdToSave, { partnerId: editingPlayer.value.id });
        } else if (editingPlayer.value.partnerId) {
          // Clear previous partner's partnerId
          await playerStore.updatePlayer(editingPlayer.value.partnerId, { partnerId: undefined });
        }

        toast.add({
          title: 'Player updated',
          description: `${playerForm.value.name} has been updated.`,
          color: 'success'
        });
      }
    } else {
      const newPlayer = await playerStore.addPlayer(
        playerForm.value.name,
        playerForm.value.skillLevel,
        partnerIdToSave
      );
      if (newPlayer) {
        // Update partner relationship for new player
        if (partnerIdToSave) {
          await playerStore.updatePlayer(partnerIdToSave, { partnerId: newPlayer.id });
        }

        toast.add({
          title: 'Player added',
          description: `${playerForm.value.name} has been added.`,
          color: 'success'
        });
      } else {
        throw new Error('Failed to add player');
      }
    }

    cancelPlayerForm();
  } catch (error) {
    console.error('Error saving player:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to save player.',
      color: 'error'
    });
  }
}

function cancelPlayerForm(): void {
  showAddPlayer.value = false;
  editingPlayer.value = null;
  playerForm.value = {
    name: '',
    skillLevel: 3.0,
    partnerId: 'none'
  };
}

async function performImport(): Promise<void> {
  try {
    // Parse CSV
    const lines = importData.value.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have a header and at least one row.');
    }
    const headers = lines[0].split(',').map(h => h.trim());
    const playersData: PlayerImportData[] = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: PlayerImportData = {
        name: '',
        skillLevel: 3.0
      };
      headers.forEach((h, i) => {
        if (h === 'skillLevel') {
          obj.skillLevel = parseFloat(values[i] || '3.0');
        } else if (h === 'partnerName') {
          obj.partnerName = values[i] ? values[i] : undefined;
        } else {
          obj[h] = values[i];
        }
      });

      // Validate required fields
      if (!obj.name) {
        obj.name = 'Unnamed Player';
      }
      if (isNaN(obj.skillLevel)) {
        obj.skillLevel = 3.0;
      }

      return obj;
    });

    // Import players without partners first
    const tempPlayers: Player[] = playersData.map(p => ({
      id: crypto.randomUUID(), // Temporary ID, will be replaced by the store
      name: p.name,
      skillLevel: p.skillLevel
    }));

    const importResult = await playerStore.importPlayers(tempPlayers);

    if (!importResult.success) {
      toast.add({
        title: 'Import failed',
        description: importResult.message,
        color: 'error'
      });
      return;
    }

    // Now that all players are added, update partners
    for (const playerData of playersData) {
      if (playerData.partnerName) {
        const player = playerStore.players.find(p => p.name === playerData.name);
        const partner = playerStore.players.find(p => p.name === playerData.partnerName);

        if (player && partner) {
          await playerStore.updatePlayer(player.id, { ...player, partnerId: partner.id });
        } else {
          toast.add({
            title: 'Warning',
            description: `Partner "${playerData.partnerName}" not found for player "${playerData.name}".`,
            color: 'warning'
          });
        }
      }
    }

    toast.add({
      title: 'Import successful',
      description: importResult.message,
      color: 'success'
    });
    showImportModal.value = false;
    importData.value = '';
  } catch (error) {
    console.error('Error importing players:', error);
    toast.add({
      title: 'Import failed',
      description: 'Invalid CSV format.',
      color: 'error'
    });
  }
}

function handleExportPlayers(): void {
  try {
    // Get players and convert to CSV
    const data = playerStore.players;
    if (!data.length) {
      throw new Error('No players to export.');
    }
    const headers = ['name', 'skillLevel', 'partnerName'];
    const csv = [
      headers.join(','),
      ...data.map((player: Player) =>
        headers
          .map(h => {
            if (h === 'name') {
              return player.name;
            } else if (h === 'skillLevel') {
              return player.skillLevel;
            } else if (h === 'partnerName') {
              if (player.partnerId) {
                return getPlayerName(player.partnerId);
              } else {
                return '';
              }
            }
            return ''; // Default case, should not happen
          })
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pickleball-players-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.add({
      title: 'Export successful',
      description: 'Players data has been downloaded as CSV.',
      color: 'success'
    });
  } catch (error) {
    console.error('Export failed:', error);
    toast.add({
      title: 'Export failed',
      description: 'Failed to export players.',
      color: 'error'
    });
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Player Management Header -->
    <div class="content-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Icon name="mdi:account-multiple" class="text-paddle-teal text-3xl" />
            Player Management
          </h2>
          <div class="flex gap-3">
            <UButton
              icon="i-heroicons-plus"
              class="btn-primary"
              data-testid="add-player-button"
              @click="handleAddPlayer"
            >
              Add Player
            </UButton>
            <UButton
              icon="i-heroicons-arrow-up-tray"
              class="btn-secondary"
              data-testid="import-players-button"
              @click="showImportModal = true"
            >
              Import
            </UButton>
            <UButton
              icon="i-heroicons-arrow-down-tray"
              class="btn-secondary"
              data-testid="export-players-button"
              @click="handleExportPlayers"
            >
              Export
            </UButton>
          </div>
        </div>
      </div>
    </div>
    <!-- Players Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="content-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white overflow-hidden">
        <ClientOnly>
          <div
            class="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20"
          >
            <Icon name="mdi:account-group" class="text-4xl text-blue-600 dark:text-blue-400 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-blue-700 dark:text-blue-300" data-testid="total-players-count">
              {{ totalPlayers }}
            </div>
            <div class="text-sm font-medium text-blue-600 dark:text-blue-400">Total Players</div>
          </div>
          <template #placeholder>
            <div
              class="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20"
            >
              <Icon name="mdi:account-group" class="text-4xl text-blue-600 dark:text-blue-400 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-blue-700 dark:text-blue-300">0</div>
              <div class="text-sm font-medium text-blue-600 dark:text-blue-400">Total Players</div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="content-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white overflow-hidden">
        <ClientOnly>
          <div
            class="p-6 text-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20"
          >
            <Icon name="mdi:star" class="text-4xl text-amber-600 dark:text-amber-400 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-amber-700 dark:text-amber-300">{{ averageSkillLevel }}</div>
            <div class="text-sm font-medium text-amber-600 dark:text-amber-400">Avg Skill Level</div>
          </div>
          <template #placeholder>
            <div
              class="p-6 text-center bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20"
            >
              <Icon name="mdi:star" class="text-4xl text-amber-600 dark:text-amber-400 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-amber-700 dark:text-amber-300">0.0</div>
              <div class="text-sm font-medium text-amber-600 dark:text-amber-400">Avg Skill Level</div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="content-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white overflow-hidden">
        <ClientOnly>
          <div
            class="p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20"
          >
            <Icon name="mdi:account-heart" class="text-4xl text-purple-600 dark:text-purple-400 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-purple-700 dark:text-purple-300">{{ playersWithPartners }}</div>
            <div class="text-sm font-medium text-purple-600 dark:text-purple-400">With Partners</div>
          </div>
          <template #placeholder>
            <div
              class="p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20"
            >
              <Icon name="mdi:account-heart" class="text-4xl text-purple-600 dark:text-purple-400 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-purple-700 dark:text-purple-300">0</div>
              <div class="text-sm font-medium text-purple-600 dark:text-purple-400">With Partners</div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
    <!-- Players Table -->
    <div class="content-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="mdi:format-list-bulleted" class="text-paddle-teal" />
            Players List
          </h3>
          <div class="flex items-center gap-3">
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search players..."
              class="w-64 form-input"
              data-testid="player-search-input"
            />
          </div>
        </div>
      </div>

      <div class="p-6">
        <ClientOnly>
          <UTable :data="filteredPlayers" :columns="columns" class="w-full" data-testid="players-table">
            <template #name-cell="{ row }">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-paddle-teal to-paddle-teal-light flex items-center justify-center text-white font-bold text-sm"
                >
                  {{ row.original.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <span class="text-lg font-medium">{{ row.original.name }}</span>
                </div>
              </div>
            </template>

            <template #skillLevel-cell="{ row }">
              <div class="player-skill-badge">
                {{ row.original.skillLevel }}
              </div>
            </template>

            <template #partnerId-cell="{ row }">
              <div v-if="row.original.partnerId" class="flex items-center gap-2">
                <Icon name="mdi:account-heart" class="text-paddle-red" />
                <span class="text-sm font-medium text-gray-700">
                  {{ getPlayerName(row.original.partnerId) }}
                </span>
              </div>
              <span v-else class="text-sm text-gray-400 italic">None</span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex gap-2 button-container">
                <UButton
                  icon="i-heroicons-pencil"
                  variant="ghost"
                  color="primary"
                  size="sm"
                  class="hover:bg-paddle-teal/10"
                  data-testid="edit-player-button"
                  @click="editPlayer(row.original)"
                />
                <UButton
                  icon="i-heroicons-trash"
                  variant="ghost"
                  color="error"
                  size="sm"
                  class="hover:bg-paddle-red/10"
                  data-testid="delete-player-button"
                  @click="confirmDelete(row.original)"
                />
              </div>
            </template>
          </UTable>
          <template #placeholder>
            <div class="p-8 text-center">
              <Icon name="mdi:loading" class="text-4xl text-paddle-teal animate-spin mb-4 mx-auto" />
              <div class="text-gray-500">Loading players...</div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
    <!-- Modals -->
    <ClientOnly>
      <AddEditPlayerModal
        v-model:open="showAddPlayer"
        v-model:player-form="playerForm"
        :editing-player="editingPlayer"
        :partner-options="partnerOptions"
        @save="savePlayer"
        @cancel="cancelPlayerForm"
      />
      <ImportPlayersModal v-model:open="showImportModal" v-model:import-data="importData" @import="performImport" />

      <DeletePlayerModal v-model:open="showDeleteConfirm" :player-to-delete="playerToDelete" @delete="deletePlayer" />
    </ClientOnly>
  </div>
</template>

<style>
/* Additional component-specific styles */
.button-container {
  display: flex;
  gap: 0.5rem;

  button {
    transition: all 0.2s ease;
    opacity: 0.7;
  }

  button:hover {
    transform: translateY(-1px);
    opacity: 1;
  }

  .i-heroicons\:eye-slash,
  .i-heroicons\:trash,
  .i-heroicons\:pencil,
  .i-heroicons\:eye {
    width: 2rem;
    height: 2rem;
  }
}

/* Print-specific overrides */
@media print {
  .content-card,
  .player-skill-badge,
  .btn-primary,
  .btn-secondary,
  .btn-danger {
    background: white !important;
    color: black !important;
    box-shadow: none !important;
    border: 1px solid #000 !important;
  }

  .content-card-header {
    background: white !important;
    border-bottom: 2px solid #000 !important;
  }
}
</style>
