<script setup lang="ts">
// Tab configuration
const tabs = [
  {
    key: 'players',
    label: 'Players',
    icon: 'i-heroicons-users'
  },
  {
    key: 'games',
    label: 'Generate Games',
    icon: 'i-heroicons-cog-6-tooth'
  },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: 'i-heroicons-calendar-days'
  },
  {
    key: 'print',
    label: 'Print',
    icon: 'i-heroicons-printer'
  }
];

// Active tab state
const activeTab = ref('players');

// SEO
useHead({
  title: 'Paddle Roster',
  meta: [
    { name: 'description', content: 'Intelligent player matching system for recreational pickleball leagues' }
  ]
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <UContainer class="py-8">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">
          Paddle Roster
        </h1>
        <p class="text-lg text-gray-600 mb-4">
          Intelligent player matching for recreational pickleball leagues
        </p>
        
        <!-- Quick Help -->
        <div class="max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <div class="flex items-start gap-2">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5 mt-0.5 text-blue-500" />
            <div class="text-left">
              <p class="font-medium mb-1">Getting Started:</p>
              <p>1. Add players in the <strong>Players</strong> tab</p>
              <p>2. Configure and generate games in <strong>Generate Games</strong></p>
              <p>3. View your schedule in the <strong>Schedule</strong> tab</p>
              <p>4. Create printable formats in the <strong>Print</strong> tab</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="w-full bg-white rounded-lg shadow-sm border">
        <!-- Tab Navigation -->
        <div class="border-b border-gray-200">
          <nav class="flex">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              :class="[
                'flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-2 transition-colors relative',
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              ]"
              @click="activeTab = tab.key"
            >
              <UIcon :name="tab.icon" class="w-5 h-5" />
              <span class="hidden sm:inline">{{ tab.label }}</span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <PlayersTab v-if="activeTab === 'players'" />
          <GamesTab v-else-if="activeTab === 'games'" />
          <ScheduleTab v-else-if="activeTab === 'schedule'" />
          <PrintTab v-else-if="activeTab === 'print'" />
        </div>
      </div>
    </UContainer>
  </div>
</template>
