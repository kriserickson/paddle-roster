<script setup lang="ts">
import { useAuthErrorHandler } from '~/composables/useAuthErrorHandler';

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const { isDemo, mockUser } = useMockAuth();
const gameStore = useGameStore();

// Use mock user in demo mode
const currentUser = computed(() => {
  return isDemo.value ? mockUser.value : user.value;
});

// Tab configuration
const tabs = [
  {
    description: 'Manage your club roster',
    icon: 'i-lucide-users-round',
    key: 'players',
    label: 'Players',
    step: '01'
  },
  {
    description: 'Choose players and format',
    icon: 'i-lucide-wand-sparkles',
    key: 'games',
    label: 'Build schedule',
    step: '02'
  },
  {
    description: 'Review, print and share',
    disabled: computed(() => !gameStore.currentSchedule),
    icon: 'i-lucide-calendar-range',
    key: 'schedule',
    label: 'Schedule',
    step: '03'
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

async function logout() {
  if (isDemo.value) {
    // In demo mode, just show an alert
    alert('Demo mode - logout not available. Set up Supabase to enable full authentication.');
    return;
  }

  try {
    await supabase.auth.signOut();
    await navigateTo('/auth/login');
  } catch (error: unknown) {
    const { handleAuthError } = useAuthErrorHandler();
    await handleAuthError(error);
  }
}

// SEO
useHead({
  meta: [{ content: 'Intelligent player matching system for recreational pickleball leagues', name: 'description' }],
  title: 'Paddle Roster'
});

// User display name
const userDisplayName = computed(() => {
  const currentUserValue = currentUser.value;
  if (!currentUserValue) {
    return '';
  }

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
  <div class="app-shell min-h-screen">
    <div class="app-ambient app-ambient-one" aria-hidden="true" />
    <div class="app-ambient app-ambient-two" aria-hidden="true" />
    <!-- Fixed Help/Account Menu -->
    <div class="account-menu fixed top-5 right-5 z-50">
      <UPopover mode="click" :content="{ side: 'bottom', align: 'start', sideOffset: 4 }" arrow>
        <UButton icon="i-lucide-ellipsis" variant="ghost" aria-label="Open account menu" class="icon-button" />
        <template #content>
          <div class="menu-panel space-y-1 p-1.5">
            <UButton
              icon="i-lucide-circle-help"
              variant="ghost"
              color="neutral"
              class="w-full justify-start"
              @click="openHelp"
            >
              Help
            </UButton>
            <UButton
              icon="i-lucide-log-out"
              variant="ghost"
              color="neutral"
              class="w-full justify-start"
              @click="logout"
            >
              Logout
            </UButton>
          </div>
        </template>
      </UPopover>
    </div>
    <UContainer class="relative z-10 py-5 sm:py-8">
      <!-- Header -->
      <header class="app-header mb-5">
        <div class="brand-lockup">
          <div class="brand-mark" aria-hidden="true">
            <UIcon name="i-lucide-circle-dot-dashed" />
          </div>
          <div>
            <h1 class="app-title">Paddle Roster</h1>
            <p>Balanced games. More play. Less clipboard.</p>
          </div>
        </div>

        <div v-if="currentUser" class="user-greeting">
          <span class="status-dot" aria-hidden="true" />
          <span>
            <span class="user-greeting-label">Signed in as</span>
            <strong>{{ userDisplayName }}</strong>
          </span>
        </div>
      </header>

      <!-- Demo Mode Banner -->
      <div v-if="isDemo" class="demo-notice mb-5">
        <UIcon name="i-lucide-sparkles" />
        <div>
          <strong>Demo workspace</strong>
          <span>Changes are saved on this device.</span>
        </div>
      </div>

      <!-- Workflow Navigation -->
      <div class="tab-nav mb-5">
        <nav class="workflow-nav" aria-label="Schedule workflow">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['tab-button', activeTab === tab.key ? 'active' : '', tab.disabled?.value ? 'disabled' : '']"
            :disabled="tab.disabled?.value"
            :aria-current="activeTab === tab.key ? 'step' : undefined"
            @click="!tab.disabled?.value && (activeTab = tab.key)"
          >
            <span class="tab-icon"><UIcon :name="tab.icon" /></span>
            <span class="tab-copy">
              <span class="tab-kicker">Step {{ tab.step }}</span>
              <strong>{{ tab.label }}</strong>
              <small>{{ tab.description }}</small>
            </span>
          </button>
        </nav>
      </div>

      <!-- Main Content -->
      <main class="workspace-panel">
        <PlayersTab v-if="activeTab === 'players'" />
        <GameBuilder v-else-if="activeTab === 'games'" @switch-tab="switchToTab" />
        <ScheduleTab v-else-if="activeTab === 'schedule'" />
      </main>
    </UContainer>
  </div>
</template>
