import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { MatchingOptions } from '../../../types';
import { copyMatchingOptions } from '../../../utils/matchingOptions';

const baseOptions: MatchingOptions = {
  balanceSkillLevels: true,
  courtDiversityPriority: 'balanced',
  distributeRestEqually: true,
  firstRoundSitters: ['player-1'],
  maxSkillDifference: 2,
  numberOfCourts: 2,
  numberOfRounds: 8,
  opponentDiversityPriority: 'strict',
  respectPartnerPreferences: true
};

describe('copyMatchingOptions', () => {
  it('creates a plain snapshot from reactive options', () => {
    const options = reactive(baseOptions);
    const copy = copyMatchingOptions(options);

    expect(() => structuredClone(copy)).not.toThrow();
    expect(copy).toEqual(baseOptions);
  });

  it('copies first-round sitters independently', () => {
    const firstRoundSitters = reactive(['player-1']);
    const options = reactive(Object.assign({}, baseOptions, { firstRoundSitters }));
    const copy = copyMatchingOptions(options);

    firstRoundSitters.push('player-2');

    expect(copy.firstRoundSitters).toEqual(['player-1']);
  });
});
