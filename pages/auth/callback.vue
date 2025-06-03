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
  <div class="flex items-center justify-center bg-gradient-to-br from-paddle-teal to-blue-600">
    <div class="text-center">
      <div class="mb-4">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-white animate-spin mx-auto" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">Completing sign in...</h2>
      <p class="text-white/80">Please wait while we redirect you.</p>
    </div>
  </div>
</template>
