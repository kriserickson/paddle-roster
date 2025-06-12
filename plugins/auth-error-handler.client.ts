// plugins/auth-error-handler.ts
export default defineNuxtPlugin({
  name: 'auth-error-handler',
  setup() {
    const { handleAuthError } = useAuthErrorHandler();

    // Add global error handler
    globalThis.addEventListener('unhandledrejection', async event => {
      if (event.reason?.message?.includes('Refresh Token Not Found')) {
        event.preventDefault();
        await handleAuthError(event.reason);
      }
    });
  }
});
