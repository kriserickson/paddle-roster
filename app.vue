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

// SEO
useHead({
  title: 'Pickleball Player Matching System',
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
          <UIcon name="i-heroicons-trophy" class="mr-2" />
          Pickleball Player Matching System
        </h1>
        <p class="text-lg text-gray-600">
          Intelligent player matching for recreational pickleball leagues
        </p>
      </div>

      <!-- Main Content -->
      <UTabs v-slot="{ item }" :items="tabs" class="w-full">
        <PlayersTab v-if="item.key === 'players'" />
        <GamesTab v-else-if="item.key === 'games'" />
        <ScheduleTab v-else-if="item.key === 'schedule'" />
        <PrintTab v-else-if="item.key === 'print'" />
      </UTabs>
    </UContainer>

    <!-- Toast notifications -->
    <UNotifications />
  </div>
</template>
