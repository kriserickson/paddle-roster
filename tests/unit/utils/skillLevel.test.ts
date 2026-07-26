const ERROR_RANGE_UPPER_SAMPLE = 1.9;
const WARNING_RANGE_LOWER_BOUND = 2.0;
const WARNING_RANGE_UPPER_SAMPLE = 2.9;
const INFO_RANGE_LOWER_BOUND = 3.0;
const INFO_RANGE_UPPER_SAMPLE = 3.9;
const SUCCESS_RANGE_LOWER_BOUND = 4.0;
const SUCCESS_RANGE_UPPER_SAMPLE = 4.9;
const PRIMARY_RANGE_LOWER_BOUND = 5.0;
const PRIMARY_RANGE_MIDPOINT_SAMPLE = 5.5;
const BELOW_MINIMUM_SKILL_SAMPLE = 0.5;
const ABOVE_MAXIMUM_SKILL_SAMPLE = 6.0;

import { describe, expect, it } from 'vitest';
import { getSkillLevelColor } from '../../../utils/skillLevel';

describe('skillLevel utils', () => {
  describe('getSkillLevelColor', () => {
    it('should return error for skill levels below 2', () => {
      expect(getSkillLevelColor(1.0)).toBe('error');
      expect(getSkillLevelColor(ERROR_RANGE_UPPER_SAMPLE)).toBe('error');
    });

    it('should return warning for skill levels 2.0-2.9', () => {
      expect(getSkillLevelColor(WARNING_RANGE_LOWER_BOUND)).toBe('warning');
      expect(getSkillLevelColor(WARNING_RANGE_UPPER_SAMPLE)).toBe('warning');
    });

    it('should return info for skill levels 3.0-3.9', () => {
      expect(getSkillLevelColor(INFO_RANGE_LOWER_BOUND)).toBe('info');
      expect(getSkillLevelColor(INFO_RANGE_UPPER_SAMPLE)).toBe('info');
    });

    it('should return success for skill levels 4.0-4.9', () => {
      expect(getSkillLevelColor(SUCCESS_RANGE_LOWER_BOUND)).toBe('success');
      expect(getSkillLevelColor(SUCCESS_RANGE_UPPER_SAMPLE)).toBe('success');
    });

    it('should return primary for skill levels 5.0 and above', () => {
      expect(getSkillLevelColor(PRIMARY_RANGE_LOWER_BOUND)).toBe('primary');
      expect(getSkillLevelColor(PRIMARY_RANGE_MIDPOINT_SAMPLE)).toBe('primary');
    });

    it('should handle edge cases', () => {
      expect(getSkillLevelColor(BELOW_MINIMUM_SKILL_SAMPLE)).toBe('error');
      expect(getSkillLevelColor(ABOVE_MAXIMUM_SKILL_SAMPLE)).toBe('primary');
    });
  });
});
