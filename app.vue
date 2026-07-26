<script setup lang="ts">
// Root layout - pages handle their own logic
const route = useRoute();
const hasPageMenu = computed(() => route.path === '/');
</script>

<template>
  <UApp>
    <div class="min-h-screen">
      <ThemeToggle :has-trailing-menu="hasPageMenu" />
      <NuxtPage />
    </div>
  </UApp>
</template>
