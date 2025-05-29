<script setup lang="ts">
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
  partnerId: '',
  active: true
});

// Validation schema
const playerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  skillLevel: z.number().min(1).max(5),
  partnerId: z.string().optional(),
  active: z.boolean()
});


const columns = [
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
    { label: 'No Partner', value: '' },
    ...availablePartners.map((player: Player) => ({
      label: player.name,
      value: player.id
    }))
  ];
});

// Methods
const getPlayerName = (playerId: string): string => {
  const player = playerStore.getPlayer(playerId);
  return player ? player.name : 'Unknown';
};

const editPlayer = (player: Player): void => {
  editingPlayer.value = player;
  playerForm.value = {
    name: player.name,
    skillLevel: player.skillLevel,
    partnerId: player.partnerId || '',
    active: player.active
  };
  showAddPlayer.value = true;
};

const confirmDelete = (player: Player): void => {
  playerToDelete.value = player;
  showDeleteConfirm.value = true;
};

const deletePlayer = (): void => {
  if (playerToDelete.value) {
    const success = playerStore.removePlayer(playerToDelete.value.id);
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
};

const togglePlayerActive = (player: Player): void => {
  const success = playerStore.updatePlayer(player.id, { active: !player.active });
  if (success) {
    toast.add({
      title: player.active ? 'Player deactivated' : 'Player activated',
      description: `${player.name} is now ${player.active ? 'inactive' : 'active'}.`,
      color: 'info'
    });
  }
};

const savePlayer = async (): Promise<void> => {
  try {
    const partnerIdToSave = playerForm.value.partnerId || undefined;
    if (editingPlayer.value) {
      const success = playerStore.updatePlayer(editingPlayer.value.id, {
        name: playerForm.value.name,
        skillLevel: playerForm.value.skillLevel,
        partnerId: partnerIdToSave,
        active: playerForm.value.active
      });

      if (success) {
        toast.add({
          title: 'Player updated',
          description: `${playerForm.value.name} has been updated.`,
          color: 'success'
        });
      }
    } else {
      playerStore.addPlayer(
        playerForm.value.name,
        playerForm.value.skillLevel,
        partnerIdToSave
      );

      toast.add({
        title: 'Player added',
        description: `${playerForm.value.name} has been added.`,
        color: 'success'
      });
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
};

const cancelPlayerForm = (): void => {
  showAddPlayer.value = false;
  editingPlayer.value = null;
  playerForm.value = {
    name: '',
    skillLevel: 3.0,
    partnerId: '',
    active: true
  };
};

const performImport = async (): Promise<void> => {
  try {
    const playersData = JSON.parse(importData.value);
    const result = playerStore.importPlayers(playersData);

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
};

const exportPlayers = (): void => {
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
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ totalPlayers }}</div>
          <div class="text-sm text-gray-600">Total Players</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ activePlayers.length }}</div>
          <div class="text-sm text-gray-600">Active Players</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600">{{ averageSkillLevel }}</div>
          <div class="text-sm text-gray-600">Avg Skill Level</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">{{ playersWithPartners }}</div>
          <div class="text-sm text-gray-600">With Partners</div>
        </div>
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

      <UTable :data="filteredPlayers" :columns="columns" class="w-full">
        <template #name-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge v-if="!row.original.active" color="neutral" variant="subtle" size="xs">
              Inactive
            </UBadge>
            <span :class="{ 'text-gray-500': !row.original.active }">{{ row.original.name }}</span>
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
          <div class="flex gap-1">
            <UButton icon="i-heroicons-pencil" size="xs" variant="ghost" @click="editPlayer(row.original)" />
            <UButton icon="i-heroicons-trash" size="xs" variant="ghost" color="error"
              @click="confirmDelete(row.original)" />
            <UButton :icon="row.original.active ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" size="xs"
              variant="ghost" :color="row.original.active ? 'primary' : 'secondary'"
              @click="togglePlayerActive(row.original)" />
          </div>
        </template>
      </UTable>
    </UCard>


    <!-- Add/Edit Player Modal -->
    <UModal v-model:open="showAddPlayer">

      <template #header>
        <h3 class="text-lg font-semibold">
          {{ editingPlayer ? 'Edit Player' : 'Add New Player' }}
        </h3>
      </template>

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
            <USelect v-model="playerForm.partnerId" :options="partnerOptions" option-attribute="label"
              value-attribute="value" placeholder="Select a partner (optional)" />
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
    <UModal v-model:open="showImportModal">
      <template #header>
        <h3 class="text-lg font-semibold">Import Players</h3>
      </template>

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
    <UModal v-model="showDeleteConfirm">

      <template #header>
        <h3 class="text-lg font-semibold text-red-600">Confirm Delete</h3>
      </template>

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
