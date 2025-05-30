<script setup lang="ts">
import { onMounted } from 'vue';
import type { TableColumn } from '@nuxt/ui';
import { z } from 'zod';
import type { Player } from '~/types';
import { getSkillLevelColor } from '~/utils/skillLevel';

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
  partnerId: 'none',
  active: true
});

// Validation schema
const playerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  skillLevel: z.number().min(1).max(5),
  partnerId: z.string().optional(),
  active: z.boolean()
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

const activePlayers = computed(() => playerStore.activePlayers);

const averageSkillLevel = computed(() => {
  if (activePlayers.value.length === 0) {
    return '0.0';
  }
  const total = activePlayers.value.reduce((sum: number, player: Player) => sum + player.skillLevel, 0);
  return (total / activePlayers.value.length).toFixed(1);
});

const playersWithPartners = computed(() => {
  return activePlayers.value.filter((player: Player) => player.partnerId).length;
});

const filteredPlayers = computed(() => {
  if (!searchQuery.value) {
    return playerStore.players.slice();
  }

  const query = searchQuery.value.toLowerCase();
  return playerStore.players.filter((player: Player) =>
    player.name.toLowerCase().includes(query)
  ).slice();
});

const partnerOptions = computed(() => {
  const currentPlayerId = editingPlayer.value?.id;
  const availablePartners = currentPlayerId
    ? playerStore.getAvailablePartners(currentPlayerId)
    : playerStore.activePlayers;

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
  return player ? player.name : 'Unknown';
}

function editPlayer(player: Player): void {
  editingPlayer.value = player;
  
  // Check if the player's current partner is still available
  const currentPartnerId = player.partnerId;
  const availablePartners = playerStore.getAvailablePartners(player.id);
  const isPartnerAvailable = currentPartnerId && availablePartners.some(p => p.id === currentPartnerId);
  
  playerForm.value = {
    name: player.name,
    skillLevel: player.skillLevel,
    partnerId: isPartnerAvailable ? currentPartnerId : 'none',
    active: player.active
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
    
    const success = await playerStore.removePlayer(playerToDelete.value.id);
    
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

async function togglePlayerActive(player: Player): Promise<void> {
  const success = await playerStore.updatePlayer(player.id, { active: !player.active });
  if (success) {
    toast.add({
      title: player.active ? 'Player deactivated' : 'Player activated',
      description: `${player.name} is now ${player.active ? 'inactive' : 'active'}.`,
      color: 'info'
    });
  }
}

async function savePlayer(): Promise<void> {
  try {
    const partnerIdToSave = playerForm.value.partnerId === 'none' ? undefined : playerForm.value.partnerId;
    if (editingPlayer.value) {
      const success = await playerStore.updatePlayer(editingPlayer.value.id, {
        name: playerForm.value.name,
        skillLevel: playerForm.value.skillLevel,
        partnerId: partnerIdToSave,
        active: playerForm.value.active
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
    partnerId: 'none',
    active: true
  };
}

async function performImport(): Promise<void> {
  try {
    const playersData = JSON.parse(importData.value);
    const result = await playerStore.importPlayers(playersData);

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

function exportPlayers(): void {
  try {
    const data = playerStore.exportPlayers();
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
};


</script>

<template>
  <div class="space-y-6">
    <!-- Player Management Header -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold text-gray-900">Player Management</h2>
      <div class="flex gap-2">
        <UButton icon="i-heroicons-plus" color="primary" @click="showAddPlayer = true">
          Add Player
        </UButton>
        <UButton icon="i-heroicons-arrow-up-tray" variant="outline" @click="showImportModal = true">
          Import
        </UButton>
        <UButton icon="i-heroicons-arrow-down-tray" variant="outline" @click="exportPlayers">
          Export
        </UButton>
      </div>
    </div>

    <!-- Players Summary -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <UCard>
        <ClientOnly>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">{{ totalPlayers }}</div>
            <div class="text-sm text-gray-600">Total Players</div>
          </div>
          <template #placeholder>
            <!-- Placeholder content to match server-rendered or show loading -->
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">0</div>
              <div class="text-sm text-gray-600">Total Players</div>
            </div>
          </template>
        </ClientOnly>
      </UCard>
      <UCard>
        <ClientOnly>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ activePlayers.length }}</div>
            <div class="text-sm text-gray-600">Active Players</div>
          </div>
          <template #placeholder>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">0</div>
              <div class="text-sm text-gray-600">Active Players</div>
            </div>
          </template>
        </ClientOnly>
      </UCard>
      <UCard>
        <ClientOnly>
          <div class="text-center">
            <div class="text-2xl font-bold text-yellow-600">{{ averageSkillLevel }}</div>
            <div class="text-sm text-gray-600">Avg Skill Level</div>
          </div>
          <template #placeholder>
            <div class="text-center">
              <div class="text-2xl font-bold text-yellow-600">0.0</div>
              <div class="text-sm text-gray-600">Avg Skill Level</div>
            </div>
          </template>
        </ClientOnly>
      </UCard>
      <UCard>
        <ClientOnly>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">{{ playersWithPartners }}</div>
            <div class="text-sm text-gray-600">With Partners</div>
          </div>
          <template #placeholder>
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-600">0</div>
              <div class="text-sm text-gray-600">With Partners</div>
            </div>
          </template>
        </ClientOnly>
      </UCard>
    </div>

    <!-- Players Table -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-medium">Players List</h3>
          <UInput v-model="searchQuery" icon="i-heroicons-magnifying-glass" placeholder="Search players..."
            class="w-64" />
        </div>
      </template>

      <ClientOnly>
        <UTable :data="filteredPlayers" :columns="columns" class="w-full">
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-lg" :class="{ 'text-gray-500': !row.original.active }">{{ row.original.name }}</span>
              <UBadge v-if="!row.original.active" color="warning" variant="subtle">
                Inactive
              </UBadge>
            </div>
          </template>

          <template #skillLevel-cell="{ row }">
            <UBadge :color="getSkillLevelColor(row.original.skillLevel)" variant="subtle">
              {{ row.original.skillLevel }}
            </UBadge>
          </template>

          <template #partnerId-cell="{ row }">
            <span v-if="row.original.partnerId" class="text-sm text-gray-600">
              {{ getPlayerName(row.original.partnerId) }}
            </span>
            <span v-else class="text-sm text-gray-400">None</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex gap-1 button-container">
              <UButton icon="i-heroicons-pencil" variant="ghost" @click="editPlayer(row.original)" />
              <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click="confirmDelete(row.original)" />
              <UButton :icon="row.original.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" variant="ghost"
                :color="row.original.active ? 'primary' : 'secondary'" @click="togglePlayerActive(row.original)" />
            </div>
          </template>
        </UTable>
        <template #placeholder>
          <!-- Placeholder for the table, e.g., a loading message or an empty state -->
          <div class="p-4 text-center text-gray-500">Loading players...</div>
        </template>
      </ClientOnly>
    </UCard>

    <!-- Add/Edit Player Modal -->
    <UModal v-model:open="showAddPlayer" 
      :title="editingPlayer ? 'Edit Player' : 'Add New Player'"
      description="Fill in the details below to add or edit a player."
      >
      <template #body>
        <UForm :schema="playerSchema" :state="playerForm" class="space-y-4" @submit="savePlayer">
          <UFormField label="Name" name="name" required>
            <UInput v-model="playerForm.name" placeholder="Enter player name" />
          </UFormField>

          <UFormField label="Skill Level" name="skillLevel" required>
            <UInput v-model.number="playerForm.skillLevel" type="number" step="0.25" min="1" max="5"
              placeholder="1.0 - 5.0" />
            <template #help>
              Skill level from 1.0 (beginner) to 5.0 (advanced). Decimals allowed (e.g., 3.25)
            </template>
          </UFormField>

          <UFormField label="Partner" name="partnerId">
            <USelect v-model="playerForm.partnerId" :items="partnerOptions" placeholder="Select a partner (optional)" />
          </UFormField>

          <UFormField label="Status" name="active">
            <USwitch v-model="playerForm.active" :label="playerForm.active ? 'Active' : 'Inactive'" />
          </UFormField>
        </UForm>
      </template>
      
      <template #footer>
        <UButton variant="ghost" @click="cancelPlayerForm">
          Cancel
        </UButton>
        <UButton type="submit" color="primary" @click="savePlayer">
          {{ editingPlayer ? 'Update' : 'Add' }} Player
        </UButton>
      </template>
    </UModal>

    <!-- Import Modal -->
    <UModal 
      v-model:open="showImportModal" 
      title="Import Players" 
      description="Paste JSON data to import players."
    >
      
      <template #body>
        <UFormField label="JSON Data">
          <UTextarea v-model="importData" :rows="10" placeholder="Paste JSON data here..." />
        </UFormField>
      </template>
      
      <template #footer>
        <UButton variant="ghost" @click="showImportModal = false">
          Cancel
        </UButton>
        <UButton color="primary" @click="performImport">
          Import
        </UButton>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm" title="Confirm Delete" description="Are you sure you want to delete this player?">
      
      <template #body>
        <div class="space-y-4">
          <p>Are you sure you want to delete <strong>{{ playerToDelete?.name }}</strong>?</p>
          <p class="text-sm text-gray-600">This action cannot be undone.</p>
        </div>
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" @click="showDeleteConfirm = false">
            Cancel
          </UButton>
          <UButton color="error" @click="deletePlayer">
            Delete
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
  
  
</template>

<style>
.button-container {

  .i-heroicons\:eye-slash,
  .i-heroicons\:trash,
  .i-heroicons\:pencil,
  .i-heroicons\:eye {
    width: 2rem;
    height: 2rem;
  }
}
</style>