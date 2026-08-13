<script setup lang="ts">
const MININUM_NUMBER_OF_CSV_ROWS = 2;

import type { TableColumn } from '@nuxt/ui';
import AddEditPlayerModal from '~/components/modals/AddEditPlayerModal.vue';
import DeletePlayerModal from '~/components/modals/DeletePlayerModal.vue';
import ImportPlayersModal from '~/components/modals/ImportPlayersModal.vue';
import type { Player } from '~/types';

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
  partnerId: 'none',
  skillLevel: 3.0
});

const columns: TableColumn<Player>[] = [
  {
    header: 'Name',
    id: 'name'
  },
  {
    header: 'Skill Level',
    id: 'skillLevel'
  },
  {
    header: 'Partner',
    id: 'partnerId'
  },
  {
    header: 'Actions',
    id: 'actions'
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
    partnerId: 'none',
    skillLevel: 3.0
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
    partnerId: isPartnerAvailable ? currentPartnerId : 'none',
    skillLevel: player.skillLevel
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
        color: 'success',
        description: `${playerToDelete.value.name} has been removed.`,
        title: 'Player deleted'
      });
    } else {
      toast.add({
        color: 'error',
        description: 'Failed to delete player.',
        title: 'Error'
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
        partnerId: partnerIdToSave,
        skillLevel: playerForm.value.skillLevel
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
          color: 'success',
          description: `${playerForm.value.name} has been updated.`,
          title: 'Player updated'
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
          color: 'success',
          description: `${playerForm.value.name} has been added.`,
          title: 'Player added'
        });
      } else {
        throw new Error('Failed to add player');
      }
    }

    cancelPlayerForm();
  } catch (error) {
    toast.add({
      color: 'error',
      description: 'Failed to save player.',
      title: 'Error'
    });
  }
}

function cancelPlayerForm(): void {
  showAddPlayer.value = false;
  editingPlayer.value = null;
  playerForm.value = {
    name: '',
    partnerId: 'none',
    skillLevel: 3.0
  };
}

async function performImport(): Promise<void> {
  try {
    // Parse CSV
    const lines = importData.value.trim().split('\n');
    if (lines.length < MININUM_NUMBER_OF_CSV_ROWS) {
      throw new Error('CSV must have a header and at least one row.');
    }
    const headers = (lines[0] || '').split(',').map(h => h.trim());
    const playersData: PlayerImportData[] = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: PlayerImportData = {
        name: '',
        skillLevel: 3.0
      };
      headers.forEach((h, i) => {
        if (h === 'skillLevel') {
          obj.skillLevel = Number(values[i] || '3.0');
        } else if (h === 'partnerName') {
          obj.partnerName = values[i] || undefined;
        } else {
          obj[h] = values[i];
        }
      });

      // Validate required fields
      if (!obj.name) {
        obj.name = 'Unnamed Player';
      }
      if (Number.isNaN(obj.skillLevel)) {
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
        color: 'error',
        description: importResult.message,
        title: 'Import failed'
      });
      return;
    }

    // Now that all players are added, update partners
    for (const playerData of playersData) {
      if (playerData.partnerName) {
        const player = playerStore.players.find(p => p.name === playerData.name);
        const partner = playerStore.players.find(p => p.name === playerData.partnerName);

        if (player && partner) {
          await playerStore.updatePlayer(
            player.id,
            Object.assign({}, player, {
              partnerId: partner.id
            })
          );
        } else {
          toast.add({
            color: 'warning',
            description: `Partner "${playerData.partnerName}" not found for player "${playerData.name}".`,
            title: 'Warning'
          });
        }
      }
    }

    toast.add({
      color: 'success',
      description: importResult.message,
      title: 'Import successful'
    });
    showImportModal.value = false;
    importData.value = '';
  } catch (error) {
    toast.add({
      color: 'error',
      description: 'Invalid CSV format.',
      title: 'Import failed'
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
      color: 'success',
      description: 'Players data has been downloaded as CSV.',
      title: 'Export successful'
    });
  } catch (error) {
    toast.add({
      color: 'error',
      description: 'Failed to export players.',
      title: 'Export failed'
    });
  }
}
</script>

<template>
  <div class="roster-page space-y-5">
    <!-- Player Management Header -->
    <div class="section-intro roster-intro">
      <div>
        <span class="eyebrow">Club roster</span>
        <h2>Your players, all in one place</h2>
        <p>Add skill levels and preferred partners now, then build a balanced session in a few clicks.</p>
      </div>
      <div class="section-actions">
        <UButton
          icon="i-lucide-user-round-plus"
          class="btn-primary"
          data-testid="add-player-button"
          @click="handleAddPlayer"
        >
          Add Player
        </UButton>
        <UButton
          icon="i-lucide-file-up"
          variant="outline"
          color="neutral"
          data-testid="import-players-button"
          @click="showImportModal = true"
        >
          Import
        </UButton>
        <UButton
          icon="i-lucide-download"
          variant="ghost"
          color="neutral"
          data-testid="export-players-button"
          @click="handleExportPlayers"
        >
          Export
        </UButton>
      </div>
    </div>
    <!-- Players Summary -->
    <div class="roster-stats">
      <div class="roster-stat">
        <ClientOnly>
          <div class="roster-stat-content">
            <span class="stat-icon mint"><UIcon name="i-lucide-users-round" /></span>
            <div>
              <strong data-testid="total-players-count">{{ totalPlayers }}</strong
              ><span>Total players</span>
            </div>
          </div>
          <template #placeholder>
            <div class="roster-stat-content">
              <span class="stat-icon mint"><UIcon name="i-lucide-users-round" /></span>
              <div><strong>0</strong><span>Total players</span></div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="roster-stat">
        <ClientOnly>
          <div class="roster-stat-content">
            <span class="stat-icon amber"><UIcon name="i-lucide-gauge" /></span>
            <div>
              <strong>{{ averageSkillLevel }}</strong
              ><span>Average skill</span>
            </div>
          </div>
          <template #placeholder>
            <div class="roster-stat-content">
              <span class="stat-icon amber"><UIcon name="i-lucide-gauge" /></span>
              <div><strong>0.0</strong><span>Average skill</span></div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="roster-stat">
        <ClientOnly>
          <div class="roster-stat-content">
            <span class="stat-icon coral"><UIcon name="i-lucide-heart-handshake" /></span>
            <div>
              <strong>{{ playersWithPartners }}</strong
              ><span>Partnered players</span>
            </div>
          </div>
          <template #placeholder>
            <div class="roster-stat-content">
              <span class="stat-icon coral"><UIcon name="i-lucide-heart-handshake" /></span>
              <div><strong>0</strong><span>Partnered players</span></div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
    <!-- Players Table -->
    <div class="panel roster-table-panel">
      <div class="panel-heading roster-table-heading">
        <div class="flex justify-between items-center">
          <div>
            <span class="step-label">Roster directory</span>
            <h3>Players</h3>
          </div>
          <div class="flex items-center gap-3 ml-1">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search players..."
              class="w-64"
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
                <div class="player-avatar">
                  {{ row.original.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <span class="text-lg font-medium">{{ row.original.name }}</span>
                </div>
              </div>
            </template>

            <template #skillLevel-cell="{ row }">
              <div class="skill-chip">
                {{ row.original.skillLevel }}
              </div>
            </template>

            <template #partnerId-cell="{ row }">
              <div v-if="row.original.partnerId" class="flex items-center gap-2">
                <UIcon name="i-lucide-link" class="text-paddle-red" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ getPlayerName(row.original.partnerId) }}
                </span>
              </div>
              <span v-else class="text-sm text-gray-400 dark:text-gray-500 italic">None</span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex gap-2 button-container">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="primary"
                  size="sm"
                  class="hover:bg-paddle-teal/10"
                  data-testid="edit-player-button"
                  @click="editPlayer(row.original)"
                />
                <UButton
                  icon="i-lucide-trash-2"
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
              <UIcon name="i-lucide-loader-circle" class="text-4xl text-paddle-teal animate-spin mb-4 mx-auto" />
              <div class="text-gray-500 dark:text-gray-400">Loading players...</div>
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
