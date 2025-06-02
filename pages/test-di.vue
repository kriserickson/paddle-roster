<script setup lang="ts">
import { container } from 'tsyringe';
import type { IPlayerApi } from '~/types/api';
import { TOKENS } from '~/types/api';

const title = 'Dependency Injection Test';

// Test resolving the service
const testDI = () => {
  try {
    const playerApi = container.resolve<IPlayerApi>(TOKENS.PlayerApi);
    console.log('Successfully resolved PlayerApi:', playerApi.constructor.name);
    return `Success: ${playerApi.constructor.name}`;
  } catch (error) {
    console.error('Failed to resolve PlayerApi:', error);
    return `Error: ${error}`;
  }
};

const result = ref('Not tested yet');

function runTest() {
  result.value = testDI();
}

// Test the usePlayerManager composable
const { players, loading, error, isDemo } = usePlayerManager();

onMounted(() => {
  runTest();
});
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">{{ title }}</h1>
    
    <div class="space-y-4">
      <div class="p-4 border rounded">
        <h2 class="text-lg font-semibold mb-2">Direct Container Resolution</h2>
        <p>Result: {{ result }}</p>
        <UButton @click="runTest" class="mt-2">Test DI</UButton>
      </div>
      
      <div class="p-4 border rounded">
        <h2 class="text-lg font-semibold mb-2">usePlayerManager Status</h2>
        <p>Demo Mode: {{ isDemo }}</p>
        <p>Loading: {{ loading }}</p>
        <p>Error: {{ error || 'None' }}</p>
        <p>Players Count: {{ players.length }}</p>
      </div>
    </div>  </div>
</template>
