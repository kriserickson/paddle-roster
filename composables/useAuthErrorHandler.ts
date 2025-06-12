export function useAuthErrorHandler() {
  const supabase = useSupabaseClient();

  async function handleAuthError(error: unknown) {
    // Check if this is a refresh token error
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string' &&
      (error as { message: string }).message.includes('Refresh Token Not Found')
    ) {
      // Clear the invalid session
      await supabase.auth.signOut();

      // Redirect to login page
      navigateTo('/auth/login');

      return { success: false, message: 'Your session has expired. Please log in again.' };
    }

    // Handle other errors
    throw error;
  }

  return {
    handleAuthError
  };
}
