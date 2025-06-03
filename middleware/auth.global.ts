export default defineNuxtRouteMiddleware(to => {

  const user = useSupabaseUser();
  const { isDemo } = useMockAuth();

  // Allow access to auth pages
  if (to.path.startsWith('/auth/')) {
    return;
  }

  // In demo mode, allow access to all pages
  if (isDemo.value) {
    return;
  }

  // Redirect to login if not authenticated
  if (!user.value) {
    return navigateTo('/auth/login');
  }
});
