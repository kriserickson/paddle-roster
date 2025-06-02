import 'reflect-metadata';
import { container } from 'tsyringe';
import { PlayerApiIndexedDb } from '~/services/playerApiIndexedDb';
import { PlayerApiSupabase } from '~/services/playerApiSupabase';
import { TOKENS } from '~/types/api';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  // Check if we're in demo mode
  const isDemo =
    !config.public.supabase?.url ||
    !config.public.supabase?.key ||
    config.public.supabase.url === 'https://your-project.supabase.co' ||
    config.public.supabase.url.includes('placeholder'); // Register appropriate service based on mode
  if (isDemo) {
    container.register(TOKENS.PlayerApi, PlayerApiIndexedDb);
  } else {
    container.register(TOKENS.PlayerApi, PlayerApiSupabase);
  }
});
