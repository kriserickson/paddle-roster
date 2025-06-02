<script setup lang="ts">
// Simple test page to debug authentication
const user = useSupabaseUser();
const { isDemo } = useMockAuth();

console.log('Test page - user:', user.value);
console.log('Test page - isDemo:', isDemo.value);
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="max-w-md w-full mx-4 p-8 bg-white rounded-lg shadow-lg">
      <h1 class="text-2xl font-bold mb-4">Auth Debug Page</h1>
      <div class="space-y-2">
        <p><strong>User:</strong> {{ user ? 'Authenticated' : 'Not authenticated' }}</p>
        <p><strong>Demo Mode:</strong> {{ isDemo ? 'Yes' : 'No' }}</p>
        <p><strong>User Object:</strong> {{ JSON.stringify(user, null, 2) }}</p>
      </div>
      <div class="mt-6">
        <NuxtLink to="/auth/login" class="text-blue-600 hover:underline">Go to Login</NuxtLink>
      </div>
    </div>
  </div>
</template>
