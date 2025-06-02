<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { Player } from '~/types';
import AddEditPlayerModal from '~/components/modals/AddEditPlayerModal.vue';
import ImportPlayersModal from '~/components/modals/ImportPlayersModal.vue';
import DeletePlayerModal from '~/components/modals/DeletePlayerModal.vue';

const {
  players,
  loading: _loading,
  error: _error,
  addPlayer,
  updatePlayer,
  removePlayer,
  getPlayer,
  getAvailablePartners,
  clearAllPlayers: _clearAllPlayers,
  importPlayers,
  exportPlayers
} = usePlayerManager();

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
const totalPlayers = computed(() => players.value.length);

const averageSkillLevel = computed(() => {
  if (players.value.length === 0) {
    return '0.0';
  }
  const total = players.value.reduce((sum: number, player: Player) => sum + player.skillLevel, 0);
  return (total / players.value.length).toFixed(1);
});

const playersWithPartners = computed(() => {
  return players.value.filter((player: Player) => player.partnerId).length;
});

const filteredPlayers = computed(() => {
  if (!searchQuery.value) {
    return players.value.slice();
  }

  const query = searchQuery.value.toLowerCase();
  return players.value.filter((player: Player) => player.name.toLowerCase().includes(query)).slice();
});

const partnerOptions = computed(() => {
  const currentPlayerId = editingPlayer.value?.id;
  const availablePartners = currentPlayerId ? getAvailablePartners(currentPlayerId) : players.value;

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
  const player = getPlayer(playerId);
  return player ? player.name : 'Unknown';
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
  const availablePartners = getAvailablePartners(player.id);
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
  console.log('deletePlayer called with:', playerToDelete.value); // Debug log

  if (playerToDelete.value) {
    console.log('Attempting to remove player:', playerToDelete.value.id); // Debug log

    const success = await removePlayer(playerToDelete.value.id);

    console.log('Remove result:', success); // Debug log

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
      const success = await updatePlayer(editingPlayer.value.id, {
        name: playerForm.value.name,
        skillLevel: playerForm.value.skillLevel,
        partnerId: partnerIdToSave
      });

      if (success) {
        // Update partner relationship
        if (partnerIdToSave) {
          await updatePlayer(partnerIdToSave, { partnerId: editingPlayer.value.id });
        } else if (editingPlayer.value.partnerId) {
          // Clear previous partner's partnerId
          await updatePlayer(editingPlayer.value.partnerId, { partnerId: undefined });
        }

        toast.add({
          title: 'Player updated',
          description: `${playerForm.value.name} has been updated.`,
          color: 'success'
        });
      }
    } else {
      const newPlayer = await addPlayer(playerForm.value.name, playerForm.value.skillLevel, partnerIdToSave);
      if (newPlayer) {
        // Update partner relationship for new player
        if (partnerIdToSave) {
          await updatePlayer(partnerIdToSave, { partnerId: newPlayer.id });
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
    const playersData = JSON.parse(importData.value);
    const result = await importPlayers(playersData);

    if (result.success) {
      toast.add({
        title: 'Import successful',
        description: result.message,
        color: 'success'
      });
      showImportModal.value = false;
      importData.value = '';
    } else {
      toast.add({
        title: 'Import failed',
        description: result.message,
        color: 'error'
      });
    }
  } catch (error) {
    console.error('Error importing players:', error);
    toast.add({
      title: 'Import failed',
      description: 'Invalid JSON format.',
      color: 'error'
    });
  }
}

function handleExportPlayers(): void {
  try {
    const data = exportPlayers();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pickleball-players-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.add({
      title: 'Export successful',
      description: 'Players data has been downloaded.',
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
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
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
      <div class="content-card overflow-hidden">
        <ClientOnly>
          <div class="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100">
            <Icon name="mdi:account-group" class="text-4xl text-blue-600 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-blue-700" data-testid="total-players-count">{{ totalPlayers }}</div>
            <div class="text-sm font-medium text-blue-600">Total Players</div>
          </div>
          <template #placeholder>
            <div class="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100">
              <Icon name="mdi:account-group" class="text-4xl text-blue-600 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-blue-700">0</div>
              <div class="text-sm font-medium text-blue-600">Total Players</div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="content-card overflow-hidden">
        <ClientOnly>
          <div class="p-6 text-center bg-gradient-to-br from-amber-50 to-amber-100">
            <Icon name="mdi:star" class="text-4xl text-amber-600 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-amber-700">{{ averageSkillLevel }}</div>
            <div class="text-sm font-medium text-amber-600">Avg Skill Level</div>
          </div>
          <template #placeholder>
            <div class="p-6 text-center bg-gradient-to-br from-amber-50 to-amber-100">
              <Icon name="mdi:star" class="text-4xl text-amber-600 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-amber-700">0.0</div>
              <div class="text-sm font-medium text-amber-600">Avg Skill Level</div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="content-card overflow-hidden">
        <ClientOnly>
          <div class="p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100">
            <Icon name="mdi:account-heart" class="text-4xl text-purple-600 mb-2 mx-auto" />
            <div class="text-3xl font-bold text-purple-700">{{ playersWithPartners }}</div>
            <div class="text-sm font-medium text-purple-600">With Partners</div>
          </div>
          <template #placeholder>
            <div class="p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100">
              <Icon name="mdi:account-heart" class="text-4xl text-purple-600 mb-2 mx-auto" />
              <div class="text-3xl font-bold text-purple-700">0</div>
              <div class="text-sm font-medium text-purple-600">With Partners</div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
    <!-- Players Table -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex justify-between items-center">
          <h3 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
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

<style scoped>
/* Additional component-specific styles */
.button-container {
  display: flex;
  gap: 0.5rem;
}

.button-container button {
  transition: all 0.2s ease;
}

.button-container button:hover {
  transform: translateY(-1px);
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
