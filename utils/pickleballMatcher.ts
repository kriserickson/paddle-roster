import type { Player, Game, GameSchedule, MatchingOptions, PlayerStats } from '~/types';

/**
 * Advanced matching algorithm for pickleball games
 */
export class PickleballMatcher {
  private players: Player[];
  private options: MatchingOptions;
  private playerStats: Map<string, PlayerStats>;

  constructor(players: Player[], options: MatchingOptions) {
    this.players = players;
    this.options = options;
    this.playerStats = new Map();
    this.initializePlayerStats();
  }

  /**
   * Generate a complete game schedule
   */
  generateSchedule(eventLabel: string = ''): GameSchedule {
    const rounds: Game[][] = [];
    const restingPlayers: string[][] = [];

    for (let round = 1; round <= this.options.numberOfRounds; round++) {
      const { games, resting } = this.generateRound(round);
      rounds.push(games);
      restingPlayers.push(resting);
      this.updatePlayerStats(games, resting);
    }

    return {
      rounds,
      restingPlayers,
      eventLabel,
      options: this.options,
      generatedAt: new Date()
    };
  }

  /**
   * Generate games for a single round
   */
  private generateRound(roundNumber: number): { games: Game[]; resting: string[] } {
    const playersThisRound = this.selectPlayersForRound();
    const resting = this.players
      .filter(p => !playersThisRound.includes(p.id))
      .map(p => p.id);

    const games = this.createGamesFromPlayers(playersThisRound, roundNumber);
    return { games, resting };
  }

  /**
   * Select players for this round, considering rest distribution
   */
  private selectPlayersForRound(): string[] {
    const totalPlayers = this.players.length;
    const playersPerRound = this.options.numberOfCourts * 4;
    
    if (totalPlayers <= playersPerRound) {
      return this.players.map(p => p.id);
    }

    // Sort players by how many rounds they've rested (ascending)
    const playersByRestCount = this.players
      .map(p => ({
        id: p.id,
        restCount: this.playerStats.get(p.id)?.roundsRested || 0,
        gamesPlayed: this.playerStats.get(p.id)?.gamesPlayed || 0
      }))
      .sort((a, b) => {
        // Primary: fewer rest periods
        if (a.restCount !== b.restCount) {
          return a.restCount - b.restCount;
        }
        // Secondary: fewer games played
        return a.gamesPlayed - b.gamesPlayed;
      });

    return playersByRestCount.slice(0, playersPerRound).map(p => p.id);
  }

  /**
   * Create games from selected players
   */
  private createGamesFromPlayers(playerIds: string[], roundNumber: number): Game[] {
    const games: Game[] = [];
    const playerPool = [...playerIds];

    // Handle partner preferences first if enabled
    if (this.options.respectPartnerPreferences) {
      this.handlePartnerPreferences(playerPool, games, roundNumber);
    }

    // Create remaining games with skill balancing
    let court = games.length + 1;
    while (playerPool.length >= 4 && court <= this.options.numberOfCourts) {
      const game = this.createBalancedGame(playerPool, roundNumber, court);
      if (game) {
        games.push(game);
        // Remove used players from pool
        playerPool.splice(playerPool.indexOf(game.team1[0]), 1);
        playerPool.splice(playerPool.indexOf(game.team1[1]), 1);
        playerPool.splice(playerPool.indexOf(game.team2[0]), 1);
        playerPool.splice(playerPool.indexOf(game.team2[1]), 1);
      }
      court++;
    }

    return games;
  }

  /**
   * Handle partner preferences by creating games for preferred partners
   */
  private handlePartnerPreferences(playerPool: string[], games: Game[], roundNumber: number): void {
    const partnersHandled = new Set<string>();

    for (const playerId of [...playerPool]) {
      if (partnersHandled.has(playerId)) continue;

      const player = this.players.find(p => p.id === playerId);
      if (!player?.partnerId) continue;

      const partner = this.players.find(p => p.id === player.partnerId);
      if (!partner || !playerPool.includes(partner.id)) continue;

      const partnerStats = this.playerStats.get(playerId);
      const timesPlayedTogether = partnerStats?.partnerCounts[partner.id] || 0;

      // Only pair partners if they haven't played together too many times
      if (timesPlayedTogether < 2) {
        const opponents = this.findBestOpponents(
          [playerId, partner.id],
          playerPool.filter(id => id !== playerId && id !== partner.id)
        );

        if (opponents.length === 2) {
          const game = this.createGameFromPlayers(
            [playerId, partner.id],
            opponents,
            roundNumber,
            games.length + 1
          );

          if (game) {
            games.push(game);
            partnersHandled.add(playerId);
            partnersHandled.add(partner.id);
            partnersHandled.add(opponents[0]);
            partnersHandled.add(opponents[1]);

            // Remove players from pool
            const toRemove = [playerId, partner.id, ...opponents];
            toRemove.forEach(id => {
              const index = playerPool.indexOf(id);
              if (index > -1) playerPool.splice(index, 1);
            });
          }
        }
      }
    }
  }

  /**
   * Create a balanced game from available players
   */
  private createBalancedGame(playerPool: string[], roundNumber: number, court: number): Game | null {
    if (playerPool.length < 4) return null;

    let bestGame: Game | null = null;
    let bestScore = Infinity;

    // Try different combinations to find the most balanced game
    const combinations = this.generateTeamCombinations(playerPool);

    for (const { team1, team2 } of combinations) {
      const game = this.createGameFromPlayers(team1, team2, roundNumber, court);
      if (!game) continue;

      const score = this.calculateGameScore(game);
      if (score < bestScore) {
        bestScore = score;
        bestGame = game;
      }
    }

    return bestGame;
  }

  /**
   * Generate all possible team combinations from player pool
   */
  private generateTeamCombinations(playerPool: string[]): { team1: string[]; team2: string[] }[] {
    const combinations: { team1: string[]; team2: string[] }[] = [];
    const players = [...playerPool];

    // Limit combinations to avoid performance issues
    const maxCombinations = Math.min(100, players.length * (players.length - 1) / 2);
    let count = 0;

    for (let i = 0; i < players.length && count < maxCombinations; i++) {
      for (let j = i + 1; j < players.length && count < maxCombinations; j++) {
        const team1 = [players[i], players[j]];
        const remaining = players.filter(p => !team1.includes(p));
        
        for (let k = 0; k < remaining.length && count < maxCombinations; k++) {
          for (let l = k + 1; l < remaining.length && count < maxCombinations; l++) {
            const team2 = [remaining[k], remaining[l]];
            combinations.push({ team1, team2 });
            count++;
          }
        }
      }
    }

    return combinations;
  }

  /**
   * Calculate a score for how good a game is (lower is better)
   */
  private calculateGameScore(game: Game): number {
    let score = 0;

    // Skill difference penalty
    if (this.options.balanceSkillLevels) {
      score += game.skillDifference * 10;
    }

    // Repeated pairing penalties
    score += this.calculateRepeatPenalty(game.team1[0], game.team1[1], 'partner');
    score += this.calculateRepeatPenalty(game.team2[0], game.team2[1], 'partner');
    score += this.calculateRepeatPenalty(game.team1[0], game.team2[0], 'opponent');
    score += this.calculateRepeatPenalty(game.team1[0], game.team2[1], 'opponent');
    score += this.calculateRepeatPenalty(game.team1[1], game.team2[0], 'opponent');
    score += this.calculateRepeatPenalty(game.team1[1], game.team2[1], 'opponent');

    return score;
  }

  /**
   * Calculate penalty for repeated pairings
   */
  private calculateRepeatPenalty(player1Id: string, player2Id: string, type: 'partner' | 'opponent'): number {
    const stats = this.playerStats.get(player1Id);
    if (!stats) return 0;

    const counts = type === 'partner' ? stats.partnerCounts : stats.opponentCounts;
    const count = counts[player2Id] || 0;

    // Exponential penalty for repeated pairings
    return Math.pow(count, 2) * 5;
  }

  /**
   * Find the best opponents for a given team
   */
  private findBestOpponents(team: string[], availablePlayers: string[]): string[] {
    if (availablePlayers.length < 2) return [];

    let bestOpponents: string[] = [];
    let bestScore = Infinity;

    for (let i = 0; i < availablePlayers.length; i++) {
      for (let j = i + 1; j < availablePlayers.length; j++) {
        const opponents = [availablePlayers[i], availablePlayers[j]];
        const game = this.createGameFromPlayers(team, opponents, 1, 1);
        
        if (game) {
          const score = this.calculateGameScore(game);
          if (score < bestScore) {
            bestScore = score;
            bestOpponents = opponents;
          }
        }
      }
    }

    return bestOpponents;
  }

  /**
   * Create a game from specific team assignments
   */
  private createGameFromPlayers(
    team1: string[],
    team2: string[],
    round: number,
    court: number
  ): Game | null {
    if (team1.length !== 2 || team2.length !== 2) return null;

    const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
    const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

    const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
    const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
    const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

    // Reject games with extreme skill mismatches if balancing is enabled
    if (this.options.balanceSkillLevels && skillDifference > this.options.maxSkillDifference) {
      return null;
    }

    return {
      id: `game_${round}_${court}`,
      round,
      court,
      team1: [team1[0], team1[1]],
      team2: [team2[0], team2[1]],
      team1SkillLevel,
      team2SkillLevel,
      skillDifference
    };
  }

  /**
   * Initialize player statistics tracking
   */
  private initializePlayerStats(): void {
    for (const player of this.players) {
      this.playerStats.set(player.id, {
        playerId: player.id,
        gamesPlayed: 0,
        roundsRested: 0,
        partneredWith: [],
        playedAgainst: [],
        partnerCounts: {},
        opponentCounts: {}
      });
    }
  }

  /**
   * Update player statistics after a round
   */
  private updatePlayerStats(games: Game[], restingPlayers: string[]): void {
    // Update resting players
    for (const playerId of restingPlayers) {
      const stats = this.playerStats.get(playerId);
      if (stats) {
        stats.roundsRested++;
      }
    }

    // Update playing players
    for (const game of games) {
      const allPlayers = [...game.team1, ...game.team2];
      
      for (const playerId of allPlayers) {
        const stats = this.playerStats.get(playerId);
        if (!stats) continue;

        stats.gamesPlayed++;

        // Update partner counts
        const teammates = allPlayers.filter(id => id !== playerId && 
          (game.team1.includes(id) === game.team1.includes(playerId)));
        
        for (const teammate of teammates) {
          stats.partnerCounts[teammate] = (stats.partnerCounts[teammate] || 0) + 1;
          if (!stats.partneredWith.includes(teammate)) {
            stats.partneredWith.push(teammate);
          }
        }

        // Update opponent counts
        const opponents = allPlayers.filter(id => id !== playerId && 
          (game.team1.includes(id) !== game.team1.includes(playerId)));
        
        for (const opponent of opponents) {
          stats.opponentCounts[opponent] = (stats.opponentCounts[opponent] || 0) + 1;
          if (!stats.playedAgainst.includes(opponent)) {
            stats.playedAgainst.push(opponent);
          }
        }
      }
    }
  }

  /**
   * Get current player statistics
   */
  getPlayerStats(): PlayerStats[] {
    return Array.from(this.playerStats.values());
  }
}
