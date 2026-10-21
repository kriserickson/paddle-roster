import type { GameSchedule } from '~/types';

/** Compare the actual round-by-round matchups, independent of display order and metadata. */
export function getScheduleSignature(schedule: GameSchedule): string {
  return JSON.stringify(
    schedule.rounds.map((round, index) => ({
      games: round
        .map(game => JSON.stringify([game.team1, game.team2].map(team => JSON.stringify([...team].sort())).sort()))
        .sort(),
      resting: [...(schedule.restingPlayers[index] || [])].sort()
    }))
  );
}
