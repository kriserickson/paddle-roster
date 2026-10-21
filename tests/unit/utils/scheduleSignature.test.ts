import { describe, expect, it } from 'vitest';
import type { Game, GameSchedule } from '~/types';
import { getScheduleSignature } from '~/utils/scheduleSignature';

const COURT_COUNT = 2;
const TEAM_SKILL = 6;

function game(id: string, court: number, team1: [string, string], team2: [string, string]): Game {
  return {
    court,
    id,
    round: 1,
    skillDifference: 0,
    team1,
    team1SkillLevel: TEAM_SKILL,
    team2,
    team2SkillLevel: TEAM_SKILL
  };
}

function createSchedule(): GameSchedule {
  return {
    eventLabel: 'Club night',
    generatedAt: new Date(),
    options: {
      balanceSkillLevels: true,
      distributeRestEqually: true,
      maxSkillDifference: 1,
      numberOfCourts: COURT_COUNT,
      numberOfRounds: COURT_COUNT,
      respectPartnerPreferences: true
    },
    restingPlayers: [
      ['9', '10'],
      ['8', '10']
    ],
    rounds: [
      [game('a', 1, ['1', '2'], ['3', '4']), game('b', COURT_COUNT, ['5', '6'], ['7', '8'])],
      [game('c', 1, ['1', '3'], ['2', '9']), game('d', COURT_COUNT, ['4', '6'], ['5', '7'])]
    ]
  };
}

describe('getScheduleSignature', () => {
  it('ignores timestamps, IDs, courts, game order, team sides, and player order within teams', () => {
    const first = createSchedule();
    const reordered = createSchedule();
    reordered.eventLabel = 'A different title';
    reordered.generatedAt = new Date(0);
    reordered.rounds = reordered.rounds.map(round =>
      round.reverse().map(original =>
        Object.assign({}, original, {
          court: original.court === 1 ? COURT_COUNT : 1,
          id: `new-${original.id}`,
          team1: [original.team2[1], original.team2[0]] as [string, string],
          team2: [original.team1[1], original.team1[0]] as [string, string]
        })
      )
    );
    reordered.restingPlayers.forEach(resting => resting.reverse());

    expect(getScheduleSignature(reordered)).toBe(getScheduleSignature(first));
  });

  it('distinguishes changed partnerships and opponents', () => {
    const first = createSchedule();
    const changed = createSchedule();
    changed.rounds[0]![0] = game('changed', 1, ['1', '3'], ['2', '4']);

    expect(getScheduleSignature(changed)).not.toBe(getScheduleSignature(first));
  });

  it('distinguishes round order and resting assignments', () => {
    const first = createSchedule();
    const reordered = createSchedule();
    reordered.rounds.reverse();
    reordered.restingPlayers.reverse();
    const changedRests = createSchedule();
    changedRests.restingPlayers[0] = ['8', '10'];

    expect(getScheduleSignature(reordered)).not.toBe(getScheduleSignature(first));
    expect(getScheduleSignature(changedRests)).not.toBe(getScheduleSignature(first));
  });
});
