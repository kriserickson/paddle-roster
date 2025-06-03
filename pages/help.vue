<script setup lang="ts">
// SEO
useHead({
  title: 'Getting Started - Paddle Roster',
  meta: [{ name: 'description', content: 'Learn how to use Paddle Roster for managing your pickleball league' }]
});

// Navigation function
function navigateToHome(): void {
  navigateTo('/');
}
</script>

<template>
  <div class="bg-gray-50 relative min-h-screen">
    <!-- Fixed Back Button -->
    <div class="absolute top-4 left-4 z-50">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        class="text-teal-600 hover:bg-teal-100 p-4 text-4xl rounded-full shadow-lg"
        @click="navigateToHome"
      />
    </div>
    <UContainer class="py-8">
      <!-- Header -->
      <div class="app-header rounded-2xl mb-8 p-8 text-center relative">
        <h1 class="app-title text-5xl font-bold mb-3 flex items-center justify-center gap-4">
          <Icon name="mdi:information" class="text-white text-5xl" />
          Getting Started
        </h1>
        <p class="text-xl text-white/90 mb-4 font-medium">
          Learn how to manage your pickleball league with Paddle Roster
        </p>
      </div>

      <!-- Main Content -->
      <div class="content-card">
        <div class="p-8">
          <!-- Introduction -->
          <div class="mb-8 text-center">
            <div class="flex items-center justify-center gap-2 mb-4">
              <Icon name="mdi:information" class="text-paddle-teal text-2xl" />
              <h2 class="text-2xl font-bold text-gray-900">Follow these steps to manage your pickleball league</h2>
            </div>
            <p class="text-gray-600 max-w-2xl mx-auto">
              Paddle Roster makes it easy to organize players, generate balanced games, and create professional
              schedules for your recreational pickleball league.
            </p>
          </div>

          <!-- Steps -->
          <div class="space-y-6 max-w-4xl mx-auto">
            <!-- Step 1 -->
            <div class="flex items-start gap-4 p-6 bg-gradient-to-r from-paddle-teal/10 to-paddle-teal/5 rounded-xl">
              <div class="flex-shrink-0">
                <Icon name="mdi:numeric-1-circle" class="text-paddle-teal text-3xl" />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Add Players</h3>
                <p class="text-gray-600 mb-3">
                  Go to the <strong>Players</strong> tab to add players with their skill levels (1.0-5.0) and optional
                  partner preferences.
                </p>
                <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                  <li>Click "Add Player" to create new player profiles</li>
                  <li>Set skill levels from 1.0 (beginner) to 5.0 (advanced)</li>
                  <li>Optionally pair players with preferred partners</li>
                  <li>Import/export player data for backup or sharing</li>
                </ul>
              </div>
            </div>

            <!-- Step 2 -->
            <div class="flex items-start gap-4 p-6 bg-gradient-to-r from-blue-50 to-blue-25 rounded-xl">
              <div class="flex-shrink-0">
                <Icon name="mdi:numeric-2-circle" class="text-blue-600 text-3xl" />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Configure Games</h3>
                <p class="text-gray-600 mb-3">
                  Use <strong>Generate Games</strong> to select players, set number of courts, and configure matching
                  preferences.
                </p>
                <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                  <li>Select which players will participate in the session</li>
                  <li>Set the number of available courts (1-5)</li>
                  <li>Choose number of rounds to generate (typically 7-9)</li>
                  <li>Configure algorithm options for skill balancing and partner preferences</li>
                </ul>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="flex items-start gap-4 p-6 bg-gradient-to-r from-amber-50 to-amber-25 rounded-xl">
              <div class="flex-shrink-0">
                <Icon name="mdi:numeric-3-circle" class="text-amber-600 text-3xl" />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">View Schedule</h3>
                <p class="text-gray-600 mb-3">
                  Check the <strong>Schedule</strong> tab to see generated games, court assignments, and resting
                  players.
                </p>
                <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                  <li>View games organized by rounds and courts</li>
                  <li>See which players are resting each round</li>
                  <li>Check skill level balance for each game</li>
                  <li>Save or load schedules for future reference</li>
                </ul>
              </div>
            </div>

            <!-- Step 4 -->
            <div class="flex items-start gap-4 p-6 bg-gradient-to-r from-purple-50 to-purple-25 rounded-xl">
              <div class="flex-shrink-0">
                <Icon name="mdi:numeric-4-circle" class="text-purple-600 text-3xl" />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Print Schedule</h3>
                <p class="text-gray-600 mb-3">
                  Use the <strong>Print</strong> tab to create professional printouts for your league.
                </p>
                <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                  <li>Customize event labels and headers</li>
                  <li>Choose from multiple print layouts</li>
                  <li>Preview before printing or saving as PDF</li>
                  <li>Export to HTML for digital sharing</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Additional Tips -->
          <div class="mt-12 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
            <h3 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="mdi:lightbulb" class="text-amber-500" />
              Pro Tips
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <h4 class="font-medium text-gray-900 mb-1">Skill Level Guidelines:</h4>
                <ul class="list-disc list-inside space-y-1">
                  <li><strong>1.0-2.0:</strong> Beginner players learning basics</li>
                  <li><strong>2.1-3.0:</strong> Developing fundamental skills</li>
                  <li><strong>3.1-4.0:</strong> Intermediate players with good control</li>
                  <li><strong>4.1-5.0:</strong> Advanced players with strategic play</li>
                </ul>
              </div>
              <div>
                <h4 class="font-medium text-gray-900 mb-1">Best Practices:</h4>
                <ul class="list-disc list-inside space-y-1">
                  <li>Regularly backup your player data</li>
                  <li>Update skill levels as players improve</li>
                  <li>Use partner preferences sparingly for best balance</li>
                  <li>Generate 7-9 rounds for optimal play time</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-8 flex justify-center gap-4">
            <UButton class="btn-primary" icon="i-heroicons-arrow-left" @click="navigateToHome"> Back to App </UButton>
            <UButton class="btn-secondary" icon="i-heroicons-users" @click="navigateTo('/?tab=players')">
              Start with Players
            </UButton>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
