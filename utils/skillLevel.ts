/**
 * Get the appropriate color for a skill level badge
 * @param skillLevel - The player's skill level (1.0 - 5.0)
 * @returns The color string for the badge component
 */
export function getSkillLevelColor(skillLevel: number): "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral" {
  if (skillLevel < 2) return 'error';
  if (skillLevel < 3) return 'warning';
  if (skillLevel < 4) return 'info';
  if (skillLevel < 5) return 'success';
  return 'primary';
}
