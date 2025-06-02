<script setup lang="ts">
import type { Player } from '~/types';

// Props
interface Props {
  open: boolean;
  playerToDelete: Player | null;
}

// Emits
interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'delete'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Computed
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

// Methods
function handleDelete(): void {
  emit('delete');
}

function handleCancel(): void {
  emit('update:open', false);
}
</script>

<template>
  <UModal v-model:open="isOpen" title="Confirm Delete">
    <template #body>
      <div class="space-y-6">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="mdi:delete-alert" class="text-paddle-red text-xl" />
          <p class="text-sm text-gray-600">Are you sure you want to delete this player?</p>
        </div>

        <div class="bg-red-50 border-l-4 border-paddle-red p-4 rounded">
          <p class="text-gray-900">
            Are you sure you want to delete <strong class="text-paddle-red">{{ playerToDelete?.name }}</strong
            >?
          </p>
          <p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
        </div>

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <UButton variant="ghost" class="btn-secondary" @click="handleCancel"> Cancel </UButton>
          <UButton class="btn-danger" @click="handleDelete"> Delete Player </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
