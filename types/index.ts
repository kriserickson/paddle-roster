/**
 * TypeScript interfaces for the Pickleball Player Matching System
 */

/**
 * Represents a pickleball player with their skill level and optional partner
 */
export interface Player {
  /** Unique identifier for the player */
  id: string;
  /** Player's full name */
  name: string;
  /** Skill level from 1-5 (decimals allowed, e.g., 3.25) */
  skillLevel: number;
  /** Optional reference to another player's ID for partner preference */
  partnerId?: string;
  /** Whether this player is currently active/available for games */
  active?: boolean;
}

/**
 * Represents a single pickleball game on a court
 */
export interface Game {
  /** Unique identifier for the game */
  id: string;
  /** Which round this game belongs to */
  round: number;
  /** Court number (1-4) */
  court: number;
  /** Player IDs for team 1 (2 players) */
  readonly team1: [string, string];
  /** Player IDs for team 2 (2 players) */
  readonly team2: [string, string];
  /** Combined skill level of team 1 */
  team1SkillLevel: number;
  /** Combined skill level of team 2 */
  team2SkillLevel: number;
  /** Skill difference between teams (for balancing) */
  skillDifference: number;
}

/**
 * Configuration options for the matching algorithm
 */
export interface MatchingOptions {
  /** Number of courts available (1-4) */
  numberOfCourts: number;
  /** Number of rounds to generate (typically 7-9) */
  numberOfRounds: number;
  /** Whether to attempt skill level balancing */
  balanceSkillLevels: boolean;
  /** Whether to attempt to pair partners together in at least one game */
  respectPartnerPreferences: boolean;
  /** Maximum skill difference allowed between teams */
  maxSkillDifference: number;
  /** Whether to ensure equal distribution of rest periods */
  distributeRestEqually: boolean;
}

/**
 * Represents a complete game schedule for all rounds
 */
export interface GameSchedule {
  /** All games organized by round */
  rounds: Game[][];
  /** Players sitting out each round (1-4 players per round) */
  restingPlayers: string[][];
  /** Tournament/event label for printing */
  eventLabel: string;
  /** Configuration used to generate this schedule */
  options: MatchingOptions;
  /** Timestamp when schedule was generated */
  generatedAt: Date;
}

/**
 * Statistics about player participation
 */
export interface PlayerStats {
  /** Player ID */
  playerId: string;
  /** Number of games played */
  gamesPlayed: number;
  /** Number of rounds rested */
  roundsRested: number;
  restRounds: number[];
  /** List of players this player has been paired with */
  partneredWith: string[];
  /** List of players this player has played against */
  playedAgainst: string[];
  /** Number of times played with each partner */
  partnerCounts: Record<string, number>;
  /** Number of times played against each opponent */
  opponentCounts: Record<string, number>;
}

/**
 * Print configuration for generating printable schedules
 */
export interface PrintOptions {
  /** Event title/header for the printout */
  eventTitle: string;
  /** Optional subtitle (e.g., date, location) */
  eventSubtitle?: string;
  /** Event date for the printout */
  eventDate?: string;
  /** Location for the event */
  location?: string;
  /** Organizer name */
  organizer?: string;
  /** Page orientation */
  orientation: 'portrait' | 'landscape';
  /** Whether to use compact layout */
  compactLayout?: boolean;
  /** Whether to show colors (false for black and white printers) */
  colorMode?: boolean;
  /** Whether to show player skill ratings and differences */
  showRatings?: boolean;
}
