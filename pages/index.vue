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
  }
];

// Active tab state
const route = useRoute();
const activeTab = ref('players');

// Initialize tab from URL parameter
onMounted(() => {
  const tabParam = route.query.tab as string;
  if (tabParam && tabs.some(tab => tab.key === tabParam)) {
    activeTab.value = tabParam;
  }
});

// Methods
function switchToTab(tabKey: string): void {
  if (tabs.some(tab => tab.key === tabKey)) {
    activeTab.value = tabKey;
  }
}

function openHelp(): void {
  navigateTo('/help');
}

function openSettings() {
  navigateTo('/settings');
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
  meta: [{ name: 'description', content: 'Intelligent player matching system for recreational pickleball leagues' }]
});

// User display name
const userDisplayName = computed(() => {
  const currentUserValue = currentUser.value;
  if (!currentUserValue) return '';

  if (isDemo.value) {
    return 'Demo User';
  }

  return (
    currentUserValue.user_metadata?.full_name ||
    currentUserValue.user_metadata?.name ||
    currentUserValue.email ||
    'User'
  );
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Fixed Help/Settings Menu -->
    <div class="fixed top-4 right-4 z-50">
      <UPopover mode="hover" :content="{ side: 'bottom', align: 'start', sideOffset: 4 }" arrow>
        <UButton
          icon="i-heroicons-bars-3"
          variant="ghost"
          class="text-teal-600 hover:bg-teal-100 p-2 text-2xl dark:text-paddle-teal-light dark:hover:bg-gray-800"
        />
        <template #content>
          <div class="p-1 space-y-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
            <UButton
              icon="i-heroicons-question-mark-circle"
              variant="ghost"
              color="neutral"
              class="w-full justify-start text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="openHelp"
            >
              Help
            </UButton>
            <UButton
              icon="i-heroicons-cog-6-tooth"
              variant="ghost"
              color="neutral"
              class="w-full justify-start text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="openSettings"
            >
              Settings
            </UButton>
            <UButton
              icon="i-heroicons-arrow-right-on-rectangle"
              variant="ghost"
              color="neutral"
              class="w-full justify-start text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="logout"
            >
              Logout
            </UButton>
          </div>
        </template>
      </UPopover>
    </div>
    <UContainer class="py-8">
      <!-- Header -->
      <div class="app-header rounded-2xl mb-8 p-8 text-center relative">
        <h1 class="app-title text-5xl font-bold mb-3 flex items-center justify-center gap-4">
          <img src="/paddle-roster-128x128.webp" alt="Paddle Roster" class="w-16 h-16" />
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
      <div class="content-card bg-white dark:bg-gray-800 dark:text-gray-100">
        <!-- Tab Navigation -->
        <div class="tab-nav dark:bg-gray-800 dark:text-gray-100">
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
          <GamesTab v-else-if="activeTab === 'games'" @switch-tab="switchToTab" />
          <ScheduleTab v-else-if="activeTab === 'schedule'" />
        </div>
      </div>
    </UContainer>
  </div>
</template>

<style>
/* Add the same styles from the original app.vue */
</style>
