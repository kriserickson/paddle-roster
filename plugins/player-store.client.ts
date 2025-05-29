export default defineNuxtPlugin(async () => {
  const playerStore = usePlayerStore();
  
  // Initialize the store by loading saved data
  const result = await playerStore.initializeStore();
  
  if (!result.success) {
    console.warn('Failed to initialize player store:', result.message);
  }
});
