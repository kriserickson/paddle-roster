/**
 * Auto-load user preferences when authenticated
 */
export default defineNuxtPlugin(async () => {
  const user = useSupabaseUser();
  const gameStore = useGameStore();

  // Watch for authentication changes
  watch(
    user,
    async newUser => {
      if (newUser) {
        // User is authenticated, load their preferences
        try {
          await gameStore.loadUserPreferences();
        } catch (error) {
          console.error('Failed to load user preferences:', error);
        }
      }
    },
    { immediate: true }
  );
});
