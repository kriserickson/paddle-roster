import 'reflect-metadata';
import { container } from 'tsyringe';
import { PlayerApiIndexedDb } from '~/services/playerApiIndexedDb';
import { TOKENS } from '~/types/api';

export default defineNuxtPlugin(() => {
  // Register services
  container.register(TOKENS.PlayerApi, PlayerApiIndexedDb);
});
