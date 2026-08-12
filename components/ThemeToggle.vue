<script setup lang="ts">
defineProps<{
  hasTrailingMenu?: boolean;
}>();

const colorMode = useColorMode();
const isMounted = ref(false);
const isDark = computed(() => isMounted.value && colorMode.value === 'dark');

onMounted(() => {
  isMounted.value = true;
});

function toggleTheme(): void {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle fixed top-5 z-50 inline-flex h-10 w-10 items-center justify-center"
    :class="hasTrailingMenu ? 'right-16' : 'right-4'"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :aria-pressed="isDark"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <UIcon v-if="isDark" name="i-lucide-sun" class="h-5 w-5" aria-hidden="true" />
    <UIcon v-else name="i-lucide-moon" class="h-5 w-5" aria-hidden="true" />
  </button>
</template>
