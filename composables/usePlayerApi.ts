import { PlayerApiIndexedDb } from '~/services/playerApiIndexedDb';
import { PlayerApiSupabase } from '~/services/playerApiSupabase';
import { useRuntimeConfig } from '#app';

/**
 * Returns the correct PlayerApi implementation based on runtime config.
 * @returns PlayerApiIndexedDb | PlayerApiSupabase
 */
export function usePlayerApi() {
  const config = useRuntimeConfig();
  const isDemo =
    !config.public.supabase?.url || !config.public.supabase?.key || config.public.supabase.url.includes('placeholder');
  if (isDemo) {
    return new PlayerApiIndexedDb();
  } else {
    return new PlayerApiSupabase();
  }
}
