<script setup lang="ts">
import { z } from 'zod';
import type { Player } from '~/types';

// Props
interface Props {
  open: boolean;
  editingPlayer: Player | null;
  playerForm: {
    name: string;
    skillLevel: number;
    partnerId: string;
  };
  partnerOptions: Array<{ label: string; value: string }>;
}

// Emits
interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'save' | 'cancel'): void;
  (e: 'update:player-form', value: { name: string; skillLevel: number; partnerId: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Validation schema
const playerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  skillLevel: z.number().min(1).max(5),
  partnerId: z.string().optional()
});

// Computed
const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const localPlayerForm = computed({
  get: () => props.playerForm,
  set: (value: { name: string; skillLevel: number; partnerId: string }) => emit('update:player-form', value)
});

const nameInputRef = ref<{ inputRef: HTMLInputElement } | null>(null);

// Autofocus name field when modal opens
watch(isOpen, async (val: boolean) => {
  if (val) {
    await nextTick();
    nameInputRef.value?.inputRef.focus();
  }
});

// Methods
function handleSave(): void {
  // Round skill level to nearest 0.25 on save
  const skillLevel = localPlayerForm.value.skillLevel;
  const rounded = Math.round(Math.min(Math.max(skillLevel, 1), 5) * 4) / 4;
  localPlayerForm.value = {
    ...localPlayerForm.value,
    skillLevel: Number(rounded)
  };
  emit('save');
}

function handleCancel(): void {
  emit('cancel');
}

/**
 * Handles input for the skill level field, allowing only valid numbers between 1.0 and 5.0.
 * Does not round while typing, only clamps if out of bounds.
 */

/**
 * Rounds the skill level to the nearest 0.25 when the input loses focus.
 */
function onSkillLevelBlur(event: Event): void {
  const input = event.target as HTMLInputElement;
  const num = parseFloat(input.value);
  if (!isNaN(num)) {
    let rounded = Math.round(Math.min(Math.max(num, 1), 5) * 4) / 4;
    rounded = Number(rounded.toFixed(2));
    localPlayerForm.value = {
      ...localPlayerForm.value,
      skillLevel: rounded
    };
    input.value = rounded.toString();
  }
}

/**
 * Handles Enter key to submit the form.
 */
function onFormKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSave();
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="editingPlayer ? 'Edit Player' : 'Add New Player'">
    <template #body>
      <div class="space-y-6">
        <div class="flex items-center gap-2 mb-4">
          <Icon :name="editingPlayer ? 'mdi:account-edit' : 'mdi:account-plus'" class="text-paddle-teal text-xl" />
          <p class="text-sm text-gray-600">Fill in the details below to add or edit a player.</p>
        </div>
        <UForm
          :schema="playerSchema"
          :state="localPlayerForm"
          class="space-y-6"
          data-testid="player-form"
          @submit.prevent="handleSave"
          @keydown="onFormKeydown"
        >
          <UFormField label="Name" name="name" required>
            <UInput
              ref="nameInputRef"
              v-model="localPlayerForm.name"
              placeholder="Enter player name"
              class="form-input w-full"
              data-testid="player-name-input"
              autofocus
            />
          </UFormField>
          <UFormField label="Skill Level" name="skillLevel" required>
            <UInput
              :model-value="localPlayerForm.skillLevel.toString()"
              type="text"
              inputmode="decimal"
              pattern="^\d(\.\d{1,2})?$"
              placeholder="1.0 - 5.0"
              class="form-input w-full"
              data-testid="player-skill-level-input"
              @blur="onSkillLevelBlur"
            />
            <template #help>
              <span class="text-sm text-gray-600">
                Skill level from 1.0 (beginner) to 5.0 (advanced). Decimals allowed (e.g., 3.25)
              </span>
            </template>
          </UFormField>
          <UFormField label="Partner" name="partnerId">
            <USelect
              v-model="localPlayerForm.partnerId"
              :items="partnerOptions"
              placeholder="Select a partner (optional)"
              class="form-input w-full"
              data-testid="player-partner-select"
            />
          </UFormField>
        </UForm>

        <div class="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <UButton variant="ghost" class="btn-secondary" data-testid="cancel-player-button" @click="handleCancel">
            Cancel
          </UButton>
          <UButton type="submit" class="btn-primary" data-testid="save-player-button" @click="handleSave">
            {{ editingPlayer ? 'Update' : 'Add' }} Player
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
