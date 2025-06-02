<script setup lang="ts">
// Props
interface Props {
  open: boolean;
  importData: string;
}

// Emits
interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'update:importData', value: string): void;
  (e: 'import'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Computed
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const importDataModel = computed({
  get: () => props.importData,
  set: (value: string) => emit('update:importData', value)
});

// Methods
function handleImport(): void {
  emit('import');
}

function handleCancel(): void {
  emit('update:open', false);
}
</script>

<template>
  <UModal v-model:open="isOpen" title="Import Players">
    <template #body>
      <div class="space-y-6">
        <div class="flex items-center gap-2 mb-4">
          <Icon name="mdi:upload" class="text-paddle-teal text-xl" />
          <p class="text-sm text-gray-600">Paste JSON data to import players.</p>
        </div>

        <UFormField label="JSON Data">
          <UTextarea
            v-model="importDataModel"
            :rows="10"
            placeholder="Paste JSON data here..."
            class="form-input font-mono text-sm"
          />
        </UFormField>

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <UButton variant="ghost" class="btn-secondary" @click="handleCancel"> Cancel </UButton>
          <UButton class="btn-primary" @click="handleImport"> Import </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
