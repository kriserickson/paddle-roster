<script setup lang="ts">
defineProps<{
  hasTrailingMenu?: boolean;
}>();

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');

function toggleTheme(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <button
    type="button"
    class="fixed top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg backdrop-blur transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paddle-teal dark:border-gray-700 dark:bg-gray-800/95 dark:text-amber-300 dark:hover:bg-gray-700"
    :class="hasTrailingMenu ? 'right-16' : 'right-4'"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :aria-pressed="isDark"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <Icon v-if="isDark" name="i-heroicons-sun" class="h-5 w-5" aria-hidden="true" />
    <Icon v-else name="i-heroicons-moon" class="h-5 w-5" aria-hidden="true" />
  </button>
</template>
