export default defineNuxtPlugin(async () => {
  // Note: Player loading is now handled automatically by usePlayerManager
  // when the user authentication state changes. This plugin is kept
  // for compatibility but doesn't need to do anything.
  console.log('Player store plugin loaded - players will be loaded automatically when authenticated');
});
