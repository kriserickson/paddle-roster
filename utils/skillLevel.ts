const SKILL_LEVEL_BEGINNER = 2.75;
const SKILL_LEVEL_INTERMEDIATE = 3.4;
const SKILL_LEVEL_UPPER_INTERMEDIATE = 4;
const SKILL_LEVEL_EXPERT = 5;

/**
 * Get the appropriate color for a skill level badge
 * @param skillLevel - The player's skill level (1.0 - 5.0)
 * @returns The color string for the badge component
 */
export function getSkillLevelColor(
  skillLevel: number
): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  if (skillLevel < SKILL_LEVEL_BEGINNER) {
    return 'error';
  }
  if (skillLevel < SKILL_LEVEL_INTERMEDIATE) {
    return 'warning';
  }
  if (skillLevel < SKILL_LEVEL_UPPER_INTERMEDIATE) {
    return 'info';
  }
  if (skillLevel < SKILL_LEVEL_EXPERT) {
    return 'success';
  }
  return 'primary';
}
