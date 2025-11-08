<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useColorMode } from '#imports';

const router = useRouter();
const colorMode = useColorMode();

function goBack() {
  router.push('/');
}

function handleDarkModeChange(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (target && typeof target.checked === 'boolean') {
    colorMode.preference = target.checked ? 'dark' : 'light';
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <!-- Back Button -->
    <button
      aria-label="Back to Home"
      class="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-paddle-teal dark:text-paddle-teal-light shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition"
      @click="goBack"
    >
      <Icon name="i-heroicons-arrow-left" class="w-5 h-5" />
      <span class="font-medium">Back</span>
    </button>
    <div class="max-w-md w-full p-8 rounded-2xl shadow-xl bg-white text-gray-900 dark:bg-gray-800 dark:text-white">
      <h1 class="text-2xl font-bold mb-6 text-center">Settings</h1>
      <div class="flex items-center justify-between py-4">
        <span class="text-lg">Dark Mode</span>
        <label class="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            class="form-checkbox h-6 w-6 text-paddle-teal"
            :checked="colorMode.value === 'dark'"
            @change="handleDarkModeChange"
          />
          <span class="ml-2">{{ colorMode.value === 'dark' ? 'On' : 'Off' }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
