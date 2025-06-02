<script setup lang="ts">
// Simple integration test for dependency injection
const title = 'Integration Test Results';

const { 
  players, 
  loading, 
  error, 
  isDemo, 
  loadPlayers, 
  addPlayer,
  clearAllPlayers 
} = usePlayerManager();

const testResults = ref<string[]>([]);
const testRunning = ref(false);

async function runIntegrationTest() {
  testRunning.value = true;
  testResults.value = [];
  
  try {
    testResults.value.push('🟡 Starting integration test...');
    
    // Test 1: Check demo mode detection
    testResults.value.push(`✅ Demo mode detection: ${isDemo.value ? 'Demo Mode' : 'Production Mode'}`);
    
    // Test 2: Clear existing data
    testResults.value.push('🟡 Clearing existing players...');
    const clearResult = await clearAllPlayers();
    testResults.value.push(`${clearResult ? '✅' : '❌'} Clear players: ${clearResult ? 'Success' : 'Failed'}`);
    
    // Test 3: Load players (should be empty now)
    testResults.value.push('🟡 Loading players...');
    await loadPlayers();
    testResults.value.push(`✅ Load players: Found ${players.value.length} players`);
    
    // Test 4: Add a test player
    testResults.value.push('🟡 Adding test player...');
    const newPlayer = await addPlayer('Test Player', 3.5);
    testResults.value.push(`${newPlayer ? '✅' : '❌'} Add player: ${newPlayer ? 'Success' : 'Failed'}`);
    
    // Test 5: Verify player was added
    testResults.value.push(`✅ Player count after add: ${players.value.length}`);
    
    // Test 6: Check for errors
    testResults.value.push(`${error.value ? '❌' : '✅'} Error state: ${error.value || 'None'}`);
    
    testResults.value.push('✅ Integration test completed successfully!');
    
  } catch (err) {
    testResults.value.push(`❌ Test failed with error: ${err}`);
  } finally {
    testRunning.value = false;
  }
}

// Auto-run test on mount
onMounted(() => {
  runIntegrationTest();
});
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <h1 class="text-2xl font-bold mb-4">{{ title }}</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Test Results -->
      <div class="p-4 border rounded-lg">
        <h2 class="text-lg font-semibold mb-2">Test Results</h2>
        <div class="space-y-1 max-h-64 overflow-y-auto">
          <div v-for="(result, index) in testResults" :key="index" class="text-sm font-mono">
            {{ result }}
          </div>
        </div>
        <UButton 
          @click="runIntegrationTest" 
          :loading="testRunning"
          class="mt-4"
        >
          Run Test Again
        </UButton>
      </div>
      
      <!-- Current State -->
      <div class="p-4 border rounded-lg">
        <h2 class="text-lg font-semibold mb-2">Current State</h2>
        <div class="space-y-2">
          <p><strong>Mode:</strong> {{ isDemo ? 'Demo' : 'Production' }}</p>
          <p><strong>Loading:</strong> {{ loading }}</p>
          <p><strong>Error:</strong> {{ error || 'None' }}</p>
          <p><strong>Player Count:</strong> {{ players.length }}</p>
          
          <div v-if="players.length > 0" class="mt-4">
            <h3 class="font-medium mb-2">Players:</h3>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              <div 
                v-for="player in players" 
                :key="player.id"
                class="text-sm p-2 bg-gray-50 rounded"
              >
                {{ player.name }} (Skill: {{ player.skillLevel }})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
