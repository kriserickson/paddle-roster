export default defineAppConfig({
  ui: {
    icons: {
      close: 'i-heroicons-x-mark'
    },
    notifications: {
      timeout: 2500 // Reduced from default ~5000ms to 2500ms (50% shorter)
    }
  },
  toaster: {
    position: 'top-center' as const
  }
});
