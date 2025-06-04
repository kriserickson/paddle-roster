<script setup lang="ts">
// Handle the auth callback
const user = useSupabaseUser();

// Redirect to home after successful auth
watchEffect(() => {
  if (user.value) {
    navigateTo('/');
  }
});
</script>

<template>
  <div
    class="flex items-center justify-center bg-gradient-to-br from-paddle-teal to-blue-600 dark:from-gray-900 dark:to-gray-800 min-h-screen"
  >
    <div class="text-center">
      <div class="mb-4">
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 text-white dark:text-paddle-teal-light animate-spin mx-auto"
        />
      </div>
      <h2 class="text-xl font-semibold text-white dark:text-paddle-teal-light mb-2">Completing sign in...</h2>
      <p class="text-white/80 dark:text-gray-300">Please wait while we redirect you.</p>
    </div>
  </div>
</template>
