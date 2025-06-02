<script setup lang="ts">
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const { isDemo, mockUser } = useMockAuth();

// Use mock user in demo mode
const currentUser = computed(() => {
  return isDemo.value ? mockUser.value : user.value;
});

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

// Modal state
const showHelp = ref(false);

// Methods
function openHelp() {
  showHelp.value = true;
}

function openSettings() {
  // TODO: Implement settings
}

async function logout() {
  if (isDemo.value) {
    // In demo mode, just show an alert
    alert('Demo mode - logout not available. Set up Supabase to enable full authentication.');
    return;
  }
  
  try {
    await supabase.auth.signOut();
    await navigateTo('/auth/login');
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

// SEO
useHead({
  title: 'Paddle Roster',
  meta: [
    { name: 'description', content: 'Intelligent player matching system for recreational pickleball leagues' }
  ]
});

// User display name
const userDisplayName = computed(() => {
  const currentUserValue = currentUser.value;
  if (!currentUserValue) return '';
  
  if (isDemo.value) {
    return 'Demo User';
  }
  
  return currentUserValue.user_metadata?.full_name || 
         currentUserValue.user_metadata?.name || 
         currentUserValue.email || 
         'User';
});
</script>

<template>
  <div class="min-h-screen">
    <UContainer class="py-8">
      <!-- Header -->
      <div class="app-header rounded-2xl mb-8 p-8 text-center relative">
        <!-- Hamburger Menu -->
        <div class="absolute top-6 right-6">
          <UPopover :popper="{ placement: 'bottom-end' }">
            <UButton icon="i-heroicons-bars-3" variant="ghost" class="text-white hover:bg-white/20" size="lg" />
            
            <template #panel="{ close }">
              <div class="p-1 space-y-1">
                <UButton
                  icon="i-heroicons-question-mark-circle"
                  variant="ghost"
                  class="w-full justify-start"
                  @click="() => { openHelp(); close(); }"
                >
                  Help
                </UButton>
                <UButton
                  icon="i-heroicons-cog-6-tooth"
                  variant="ghost"
                  class="w-full justify-start"
                  @click="() => { openSettings(); close(); }"
                >
                  Settings
                </UButton>
                <UButton
                  icon="i-heroicons-arrow-right-on-rectangle"
                  variant="ghost"
                  class="w-full justify-start"
                  @click="() => { logout(); close(); }"
                >
                  Logout
                </UButton>
              </div>
            </template>
          </UPopover>
        </div>

        <h1 class="app-title text-5xl font-bold mb-3 flex items-center justify-center gap-4">
          <img src="/paddle-roster-128x128.webp" alt="Paddle Roster" class="w-16 h-16" >
          Paddle Roster
        </h1>
        <p class="text-xl text-white/90 mb-4 font-medium">
          Intelligent player matching for recreational pickleball leagues
        </p>
        
        <!-- User Info -->
        <div v-if="currentUser" class="text-center text-white/80 text-sm">
          Welcome back, {{ userDisplayName }}!
          <span v-if="isDemo" class="block text-xs opacity-75 mt-1">
            (Demo Mode - Set up Supabase for full functionality)
          </span>
        </div>
      </div>

      <!-- Demo Mode Banner -->
      <div v-if="isDemo" class="mb-6">
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          title="Demo Mode Active"
          description="You're using demo mode with localStorage. Set up Supabase for authentication and cloud storage."
        />
      </div>

      <!-- Main Content -->
      <div class="content-card">
        <!-- Tab Navigation -->
        <div class="tab-nav">
          <nav class="flex">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              :class="[
                'tab-button flex-1 py-4 px-6 text-center font-medium text-sm flex items-center justify-center gap-3 transition-all duration-300',
                activeTab === tab.key ? 'active' : ''
              ]"
              @click="activeTab = tab.key"
            >
              <UIcon :name="tab.icon" class="w-5 h-5" />
              <span class="hidden sm:inline">{{ tab.label }}</span>
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-8">
          <PlayersTab v-if="activeTab === 'players'" />
          <GamesTab v-else-if="activeTab === 'games'" />
          <ScheduleTab v-else-if="activeTab === 'schedule'" />
          <PrintTab v-else-if="activeTab === 'print'" />
        </div>
      </div>
    </UContainer>

    <!-- Help Modal -->
    <UModal v-model:open="showHelp" title="Getting Started Guide">
      <template #body>
        <div class="space-y-6">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="mdi:information" class="text-paddle-teal text-xl" />
            <p class="text-sm text-gray-600">Follow these steps to manage your pickleball league</p>
          </div>

          <div class="space-y-4">
            <div class="flex items-start gap-3 p-4 bg-gradient-to-r from-paddle-teal/10 to-paddle-teal/5 rounded-lg">
              <Icon name="mdi:numeric-1-circle" class="text-paddle-teal text-xl mt-1" />
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">Add Players</h3>
                <p class="text-sm text-gray-600">Go to the <strong>Players</strong> tab to add players with their skill levels (1.0-5.0) and optional partner preferences.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-25 rounded-lg">
              <Icon name="mdi:numeric-2-circle" class="text-blue-600 text-xl mt-1" />
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">Configure Games</h3>
                <p class="text-sm text-gray-600">Use <strong>Generate Games</strong> to select players, set number of courts, and configure matching preferences.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50 to-amber-25 rounded-lg">
              <Icon name="mdi:numeric-3-circle" class="text-amber-600 text-xl mt-1" />
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">View Schedule</h3>
                <p class="text-sm text-gray-600">Check the <strong>Schedule</strong> tab to see generated games, court assignments, and resting players.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-25 rounded-lg">
              <Icon name="mdi:numeric-4-circle" class="text-purple-600 text-xl mt-1" />
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">Print Schedule</h3>
                <p class="text-sm text-gray-600">Use the <strong>Print</strong> tab to create professional printouts for your league.</p>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-4 border-t border-gray-200">
            <UButton class="btn-primary" @click="showHelp = false">
              Got it!
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
/* Add the same styles from the original app.vue */
</style>
