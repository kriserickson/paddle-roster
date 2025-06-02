// Mock Supabase user for development when SUPABASE_URL is not configured
export function useMockAuth() {
  const mockUser = ref({
    id: 'mock-user-id',
    email: 'demo@example.com',
    user_metadata: {
      full_name: 'Demo User',
      name: 'Demo User'
    }
  });
  const config = useRuntimeConfig();
  const isDemo = computed(() => {
    // Check if we have valid Supabase configuration
    const supabaseUrl = config.public.supabase?.url;
    const supabaseKey = config.public.supabase?.key;

    // If no Supabase config or using placeholder values, use demo mode
    return (
      !supabaseUrl ||
      !supabaseKey ||
      supabaseUrl === 'https://your-project.supabase.co' ||
      supabaseUrl.includes('placeholder')
    );
  });

  return {
    mockUser,
    isDemo
  };
}
