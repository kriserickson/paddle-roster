import { describe, expect, it } from 'vitest';
import { createBalancedRestPlan } from '~/utils/restPlanner';

const PLAYERS_PER_COURT = 4;
const MAX_COURTS = 4;
const MAX_ROUNDS = 15;
const EIGHT_PLAYERS = 8;
const TEN_PLAYERS = 10;
const TWO_SITTERS = 2;
const MATRIX_TEST_TIMEOUT_MS = 30000;

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

function assertBalanced(plan: string[][], players: string[], sitters: number): void {
  const counts = new Map(players.map(player => [player, 0]));
  for (const round of plan) {
    expect(round).toHaveLength(sitters);
    expect(new Set(round).size).toBe(sitters);
    for (const player of round) {
      expect(counts.has(player)).toBe(true);
      counts.set(player, counts.get(player)! + 1);
    }
  }
  const totalSlots = plan.length * sitters;
  const minimum = Math.floor(totalSlots / players.length);
  const maximum = Math.ceil(totalSlots / players.length);
  for (const count of counts.values()) {
    expect(count).toBeGreaterThanOrEqual(minimum);
    expect(count).toBeLessThanOrEqual(maximum);
  }
}

function repeatedPairs(plan: string[][]): number {
  const pairs = new Set<string>();
  let repeats = 0;
  for (const resting of plan) {
    resting.forEach((first, index) => {
      for (const second of resting.slice(index + 1)) {
        const key = JSON.stringify([first, second].sort());
        if (pairs.has(key)) repeats += 1;
        pairs.add(key);
      }
    });
  }
  return repeats;
}

describe('balanced rest planner', () => {
  it.each([
    { players: 10, rounds: 8, sitters: 2 },
    { players: 10, rounds: 12, sitters: 2 },
    { players: 6, rounds: 15, sitters: 2 },
    { players: 7, rounds: 7, sitters: 3 },
    { players: 11, rounds: 15, sitters: 3 },
    { players: 16, rounds: 15, sitters: 4 },
    { players: 20, rounds: 15, sitters: 4 }
  ])('avoids repeat rest partners with $players players and $sitters sitters over $rounds rounds', scenario => {
    const players = playerIds(scenario.players);
    const plan = createBalancedRestPlan(players, scenario.sitters, scenario.rounds);

    assertBalanced(plan, players, scenario.sitters);
    expect(repeatedPairs(plan)).toBe(0);
  });

  it(
    'keeps exact floor/ceiling quotas for every supported court, sitter, and round count',
    () => {
      for (let courts = 1; courts <= MAX_COURTS; courts += 1) {
        for (let sitters = 1; sitters <= PLAYERS_PER_COURT; sitters += 1) {
          const players = playerIds(courts * PLAYERS_PER_COURT + sitters);
          for (let rounds = 1; rounds <= MAX_ROUNDS; rounds += 1) {
            const required = players.slice(-sitters);
            const plan = createBalancedRestPlan(players, sitters, rounds, required);

            expect(plan).toHaveLength(rounds);
            expect(plan[0]).toEqual(expect.arrayContaining(required));
            assertBalanced(plan, players, sitters);
          }
        }
      }
    },
    MATRIX_TEST_TIMEOUT_MS
  );

  it('balances rest totals when some repeat rest partners are mathematically unavoidable', () => {
    const players = playerIds(EIGHT_PLAYERS);
    const plan = createBalancedRestPlan(players, PLAYERS_PER_COURT, MAX_ROUNDS);

    assertBalanced(plan, players, PLAYERS_PER_COURT);
    expect(repeatedPairs(plan)).toBeGreaterThan(0);
    expect(new Set(plan.map(round => JSON.stringify([...round].sort()))).size).toBeGreaterThan(PLAYERS_PER_COURT);
  });

  it('does not modify the roster or requested first sitters', () => {
    const players = playerIds(TEN_PLAYERS);
    const original = [...players];
    const required = ['9'];
    createBalancedRestPlan(players, TWO_SITTERS, EIGHT_PLAYERS, required);

    expect(players).toEqual(original);
    expect(required).toEqual(['9']);
  });

  it('returns empty resting blocks when all players can play', () => {
    const plan = createBalancedRestPlan(playerIds(PLAYERS_PER_COURT), 0, MAX_ROUNDS);
    expect(plan).toEqual(Array.from({ length: MAX_ROUNDS }, () => []));
  });
});
