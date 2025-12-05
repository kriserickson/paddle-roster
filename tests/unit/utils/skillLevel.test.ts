import { describe, expect, it } from 'vitest';
import { getSkillLevelColor } from '../../../utils/skillLevel';

describe('skillLevel utils', () => {
  describe('getSkillLevelColor', () => {
    it('should return error for skill levels below 2', () => {
      expect(getSkillLevelColor(1.0)).toBe('error');
      expect(getSkillLevelColor(1.9)).toBe('error');
    });

    it('should return warning for skill levels 2.0-2.9', () => {
      expect(getSkillLevelColor(2.0)).toBe('warning');
      expect(getSkillLevelColor(2.9)).toBe('warning');
    });

    it('should return info for skill levels 3.0-3.9', () => {
      expect(getSkillLevelColor(3.0)).toBe('info');
      expect(getSkillLevelColor(3.9)).toBe('info');
    });

    it('should return success for skill levels 4.0-4.9', () => {
      expect(getSkillLevelColor(4.0)).toBe('success');
      expect(getSkillLevelColor(4.9)).toBe('success');
    });

    it('should return primary for skill levels 5.0 and above', () => {
      expect(getSkillLevelColor(5.0)).toBe('primary');
      expect(getSkillLevelColor(5.5)).toBe('primary');
    });

    it('should handle edge cases', () => {
      expect(getSkillLevelColor(0.5)).toBe('error');
      expect(getSkillLevelColor(6.0)).toBe('primary');
    });
  });
});
