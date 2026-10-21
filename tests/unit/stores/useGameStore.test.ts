import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, readonly, ref } from 'vue';
import { useGameStore } from '~/stores/useGameStore';
import { usePrintStore } from '~/stores/usePrintStore';
import type { Player } from '~/types';
import { PickleballMatcher } from '~/utils/pickleballMatcher';
import { getScheduleSignature } from '~/utils/scheduleSignature';

vi.mock('~/services/userPreferencesApiSupabase', () => ({
  UserPreferencesApiSupabase: class {}
}));

const PLAYER_COUNT = 10;
const COURT_COUNT = 2;
const ROUND_COUNT = 3;
const REGENERATION_COUNT = 3;
const PLAYERS_PER_COURT = 4;
const EIGHT_ROUNDS = 8;

describe('schedule generation', () => {
  let players: Player[];

  beforeEach(() => {
    setActivePinia(createPinia());
    players = Array.from({ length: PLAYER_COUNT }, (_, index) => ({
      id: String(index + 1),
      name: `Player ${index + 1}`,
      skillLevel: 3
    }));
    vi.stubGlobal('computed', computed);
    vi.stubGlobal('ref', ref);
    vi.stubGlobal('readonly', readonly);
    vi.stubGlobal('usePlayerStore', () => ({ selectedPlayers: players }));
    vi.stubGlobal('usePrintStore', usePrintStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps one or more chosen players in the first resting block when courts are reduced', async () => {
    const store = useGameStore();
    store.matchingOptions.numberOfRounds = ROUND_COUNT;

    for (const sitters of [['1'], ['1', '2']]) {
      store.matchingOptions.firstRoundSitters = sitters;
      const schedule = await store.generateSchedule('Club night');

      expect(schedule?.options.numberOfCourts).toBe(COURT_COUNT);
      expect(schedule?.restingPlayers[0]).toHaveLength(COURT_COUNT);
      expect(schedule?.restingPlayers[0]).toEqual(expect.arrayContaining(sitters));
      expect(schedule?.eventLabel).toBe('Club night');
      for (const game of schedule!.rounds[0]!) {
        for (const sitter of sitters) {
          expect([...game.team1, ...game.team2]).not.toContain(sitter);
        }
      }
    }
  });

  it('regenerates different matchups even with identical random values, keeping first-rest choices and the roster', async () => {
    const store = useGameStore();
    store.matchingOptions.numberOfRounds = ROUND_COUNT;
    store.matchingOptions.firstRoundSitters = ['1', '2'];
    const originalRoster = players.map(player => player.id);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let previous = await store.generateSchedule('Club night');

    for (let attempt = 0; attempt < REGENERATION_COUNT; attempt += 1) {
      const next = await store.generateSchedule(previous!.eventLabel);

      expect(getScheduleSignature(next!)).not.toBe(getScheduleSignature(previous!));
      expect(next?.restingPlayers[0]).toEqual(expect.arrayContaining(['1', '2']));
      expect(next?.eventLabel).toBe('Club night');
      expect(players.map(player => player.id)).toEqual(originalRoster);
      expect(store.currentSchedule).toEqual(next);
      expect(store.isGenerating).toBe(false);
      previous = next;
    }
  });

  it('keeps the previous schedule if regeneration fails', async () => {
    const store = useGameStore();
    store.matchingOptions.numberOfRounds = ROUND_COUNT;
    const first = await store.generateSchedule('Club night');
    const printStore = usePrintStore();
    printStore.updatePrintOptions({ eventTitle: 'Current event' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(PickleballMatcher.prototype, 'generateSchedule').mockRejectedValue(new Error('Generation failed'));

    await expect(store.generateSchedule('Club night')).rejects.toThrow('Generation failed');
    expect(store.currentSchedule).toEqual(first);
    expect(printStore.printOptions.eventTitle).toBe('Current event');
    expect(store.isGenerating).toBe(false);
  });

  it('clears the print Event Name after generating or regenerating while preserving other print settings', async () => {
    const store = useGameStore();
    const printStore = usePrintStore();
    store.matchingOptions.numberOfRounds = ROUND_COUNT;

    for (const eventTitle of ['Previous event', 'Current event']) {
      printStore.updatePrintOptions({ eventTitle, location: 'Club courts', orientation: 'portrait' });
      await store.generateSchedule('Club night');

      expect(printStore.printOptions.eventTitle).toBe('');
      expect(printStore.printOptions.location).toBe('Club courts');
      expect(printStore.printOptions.orientation).toBe('portrait');
    }
  });

  it('always balances rests and changes rest partners, including when regenerating with older preferences', async () => {
    const store = useGameStore();
    store.matchingOptions.numberOfRounds = EIGHT_ROUNDS;
    store.matchingOptions.distributeRestEqually = false;
    store.matchingOptions.firstRoundSitters = ['1', '2'];

    for (const attempt of [0, 1]) {
      const schedule = await store.generateSchedule(`Club night ${attempt}`);
      const counts = players.map(player => schedule!.restingPlayers.filter(round => round.includes(player.id)).length);
      const restPairs = schedule!.restingPlayers.map(round => JSON.stringify([...round].sort()));

      expect(schedule?.options.distributeRestEqually).toBe(true);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(new Set(restPairs).size).toBe(EIGHT_ROUNDS);
      expect(schedule?.restingPlayers[0]).toEqual(expect.arrayContaining(['1', '2']));
    }
  });

  it('changes actual partnerships for a single court and single round', async () => {
    players = players.slice(0, PLAYERS_PER_COURT);
    const store = useGameStore();
    store.matchingOptions.numberOfCourts = 1;
    store.matchingOptions.numberOfRounds = 1;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = await store.generateSchedule();
    const second = await store.generateSchedule();

    expect(getScheduleSignature(second!)).not.toBe(getScheduleSignature(first!));
  });

  it('reports when no alternative is found instead of silently returning the same match', async () => {
    players = players.slice(0, PLAYERS_PER_COURT);
    const store = useGameStore();
    store.matchingOptions.numberOfCourts = 1;
    store.matchingOptions.numberOfRounds = 1;
    const partnerIds = ['2', '1', '4', '3'];
    players.forEach((player, index) => {
      player.partnerId = partnerIds[index];
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = await store.generateSchedule();

    await expect(store.generateSchedule()).rejects.toThrow('Could not find a different schedule');
    expect(store.currentSchedule).toEqual(first);
    expect(store.isGenerating).toBe(false);
  });
});
