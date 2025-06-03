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
    const resting = this.players.filter(p => !playersThisRound.includes(p.id)).map(p => p.id);

    const games = this.createGamesFromPlayers(playersThisRound, roundNumber);
    return { games, resting };
  }

  /**
   * Select players for this round, considering rest distribution and randomness
   */
  private selectPlayersForRound(): string[] {
    const totalPlayers = this.players.length;
    const playersPerRound = this.options.numberOfCourts * 4;

    if (totalPlayers <= playersPerRound) {
      return this.players.map(p => p.id);
    }

    // Calculate how many must rest this round
    const numToRest = totalPlayers - playersPerRound;
    const minRestGap = Math.floor(this.options.numberOfRounds / 2);

    // Gather rest history for each player
    const restHistory: Record<string, number[]> = {};
    for (const [id, stats] of this.playerStats.entries()) {
      restHistory[id] = stats.restRounds ? [...stats.restRounds] : [];
    }

    // Determine current round (0-based for rest logic)
    const currentRound = this.getCurrentRound() - 1;

    // Find eligible players to rest (haven't rested recently)
    let eligibleToRest = this.players
      .map(p => {
        const stats = this.playerStats.get(p.id);
        const rests = restHistory[p.id] || [];
        const lastRest = rests.length > 0 ? rests[rests.length - 1] : -minRestGap - 1;
        const roundsSinceRest = currentRound - lastRest;
        return {
          id: p.id,
          restCount: stats?.roundsRested || 0,
          gamesPlayed: stats?.gamesPlayed || 0,
          lastRest,
          roundsSinceRest
        };
      })
      .filter(p => p.roundsSinceRest >= minRestGap);

    // Shuffle eligibleToRest to introduce randomness
    eligibleToRest = this.shuffleArray(eligibleToRest);

    // Try to avoid the same group resting together repeatedly
    // We'll score each candidate group by how often they've rested together
    let bestResting: string[] = [];
    let bestScore = Infinity;

    // Generate a few random candidate groups and pick the one with least overlap
    const candidateGroups: string[][] = [];
    const tries = Math.max(10, numToRest * 3);
    for (let t = 0; t < tries; t++) {
      const group = this.pickRandomGroup(eligibleToRest, numToRest);
      candidateGroups.push(group);
    }

    for (const group of candidateGroups) {
      // Score: sum of times these players have rested together
      let score = 0;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          score += this.countRestedTogether(group[i], group[j]);
        }
      }
      if (score < bestScore) {
        bestScore = score;
        bestResting = group;
      }
    }

    // If not enough eligible, fill with next best candidates (with randomness)
    if (bestResting.length < numToRest) {
      let restCandidates = this.players.map(p => {
        const stats = this.playerStats.get(p.id);
        const rests = restHistory[p.id] || [];
        const lastRest = rests.length > 0 ? rests[rests.length - 1] : -minRestGap - 1;
        const roundsSinceRest = currentRound - lastRest;
        return {
          id: p.id,
          restCount: stats?.roundsRested || 0,
          gamesPlayed: stats?.gamesPlayed || 0,
          lastRest,
          roundsSinceRest
        };
      });
      restCandidates = this.shuffleArray(restCandidates);
      for (const c of restCandidates) {
        if (bestResting.length < numToRest && !bestResting.includes(c.id)) {
          bestResting.push(c.id);
        }
      }
    }

    // Select all others to play
    return this.players.filter(p => !bestResting.includes(p.id)).map(p => p.id);
  }

  /**
   * Shuffle an array (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Pick a random group of n ids from a list of objects with id property
   */
  private pickRandomGroup(list: { id: string }[], n: number): string[] {
    const shuffled = this.shuffleArray(list);
    return shuffled.slice(0, n).map(x => x.id);
  }

  /**
   * Count how many times two players have rested together
   */
  private countRestedTogether(id1: string, id2: string): number {
    const stats1 = this.playerStats.get(id1);
    const stats2 = this.playerStats.get(id2);
    if (!stats1 || !stats2) return 0;
    // Count rounds where both have restRounds
    return stats1.restRounds.filter(r => stats2.restRounds.includes(r)).length;
  }

  /**
   * Get the current round number based on how many rounds have been generated
   */
  private getCurrentRound(): number {
    // Count how many players have played at least one game to determine current round
    const playersWithGames = Array.from(this.playerStats.values()).filter(stats => stats.gamesPlayed > 0);
    if (playersWithGames.length === 0) return 1;

    const maxGamesPlayed = Math.max(...playersWithGames.map(stats => stats.gamesPlayed));
    return maxGamesPlayed + 1;
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
        const playersToRemove = [game.team1[0], game.team1[1], game.team2[0], game.team2[1]];
        playersToRemove.forEach(playerId => {
          const index = playerPool.indexOf(playerId);
          if (index > -1) playerPool.splice(index, 1);
        });
      } else {
        // If we can't create a balanced game, try a simpler approach
        if (playerPool.length >= 4) {
          const simpleGame = this.createSimpleGame(playerPool, roundNumber, court);
          if (simpleGame) {
            games.push(simpleGame);
            const playersToRemove = [
              simpleGame.team1[0],
              simpleGame.team1[1],
              simpleGame.team2[0],
              simpleGame.team2[1]
            ];
            playersToRemove.forEach(playerId => {
              const index = playerPool.indexOf(playerId);
              if (index > -1) playerPool.splice(index, 1);
            });
          } else {
            // Last resort: create a game with the most relaxed constraints
            const lastResortGame = this.createLastResortGame(playerPool, roundNumber, court);
            if (lastResortGame) {
              games.push(lastResortGame);
              const playersToRemove = [
                lastResortGame.team1[0],
                lastResortGame.team1[1],
                lastResortGame.team2[0],
                lastResortGame.team2[1]
              ];
              playersToRemove.forEach(playerId => {
                const index = playerPool.indexOf(playerId);
                if (index > -1) playerPool.splice(index, 1);
              });
            } else {
              break; // Can't create any more games
            }
          }
        } else {
          break; // Not enough players left
        }
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

      // Check if these partners have already played together
      const timesPlayedTogether = this.getPartnershipCount(playerId, partner.id);

      // Only pair partners if they haven't played together before
      if (timesPlayedTogether === 0) {
        const availableOpponents = playerPool.filter(
          id => id !== playerId && id !== partner.id && !partnersHandled.has(id)
        );

        const opponents = this.findBestOpponents([playerId, partner.id], availableOpponents);

        if (opponents.length === 2) {
          const game = this.createGameFromPlayers([playerId, partner.id], opponents, roundNumber, games.length + 1);

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

      // If we found a perfect game (score 0), use it immediately
      if (score === 0) {
        break;
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
    const maxCombinations = Math.min(100, (players.length * (players.length - 1)) / 2);
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

    // Partnership penalties - more lenient in later rounds
    const maxAllowedPartnerships = game.round <= 4 ? 0 : 1;

    const team1PartnerCount = this.getPartnershipCount(game.team1[0], game.team1[1]);
    const team2PartnerCount = this.getPartnershipCount(game.team2[0], game.team2[1]);

    // Heavy penalty for exceeding allowed partnerships
    if (team1PartnerCount > maxAllowedPartnerships) score += 10000;
    if (team2PartnerCount > maxAllowedPartnerships) score += 10000;

    // Moderate penalty for partnerships at the limit
    if (team1PartnerCount === maxAllowedPartnerships && maxAllowedPartnerships > 0) score += 100;
    if (team2PartnerCount === maxAllowedPartnerships && maxAllowedPartnerships > 0) score += 100;

    // Strong penalty for repeated opponent encounters (max 2 times)
    const opponentPenalties = [
      this.getOpponentCount(game.team1[0], game.team2[0]),
      this.getOpponentCount(game.team1[0], game.team2[1]),
      this.getOpponentCount(game.team1[1], game.team2[0]),
      this.getOpponentCount(game.team1[1], game.team2[1])
    ];

    opponentPenalties.forEach(count => {
      if (count >= 2) {
        score += 5000; // High penalty for 3+ opponent encounters
      } else if (count >= 1) {
        score += 50; // Moderate penalty for repeated opponents
      }
    });

    return score;
  }

  /**
   * Get the number of times two players have been partners
   */
  private getPartnershipCount(player1Id: string, player2Id: string): number {
    const stats = this.playerStats.get(player1Id);
    if (!stats) return 0;
    return stats.partnerCounts[player2Id] || 0;
  }

  /**
   * Get the number of times two players have been opponents
   */
  private getOpponentCount(player1Id: string, player2Id: string): number {
    const stats = this.playerStats.get(player1Id);
    if (!stats) return 0;
    return stats.opponentCounts[player2Id] || 0;
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
  private createGameFromPlayers(team1: string[], team2: string[], round: number, court: number): Game | null {
    if (team1.length !== 2 || team2.length !== 2) return null;

    // STRICT: Partnerships should never repeat (core pickleball scheduling requirement)
    const team1PartnerCount = this.getPartnershipCount(team1[0], team1[1]);
    const team2PartnerCount = this.getPartnershipCount(team2[0], team2[1]);

    // For most games, absolutely prevent repeated partnerships
    if (team1PartnerCount > 0 || team2PartnerCount > 0) {
      return null;
    }

    const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
    const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

    const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
    const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
    const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

    // Be more flexible with skill balancing if needed for partnership constraints
    const skillTolerance = round > 6 ? this.options.maxSkillDifference * 1.5 : this.options.maxSkillDifference;

    if (this.options.balanceSkillLevels && skillDifference > skillTolerance) {
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
        restRounds: [],
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
    const roundNum = this.getCurrentRound() - 1;
    for (const playerId of restingPlayers) {
      const stats = this.playerStats.get(playerId);
      if (stats) {
        stats.roundsRested++;
        if (!stats.restRounds) {
          stats.restRounds = [];
        }
        stats.restRounds.push(roundNum);
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
        const teammates = allPlayers.filter(
          id => id !== playerId && game.team1.includes(id) === game.team1.includes(playerId)
        );

        for (const teammate of teammates) {
          stats.partnerCounts[teammate] = (stats.partnerCounts[teammate] || 0) + 1;
          if (!stats.partneredWith.includes(teammate)) {
            stats.partneredWith.push(teammate);
          }
        }

        // Update opponent counts
        const opponents = allPlayers.filter(
          id => id !== playerId && game.team1.includes(id) !== game.team1.includes(playerId)
        );

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
   * Create a simple game without complex balancing (fallback method)
   */
  private createSimpleGame(playerPool: string[], roundNumber: number, court: number): Game | null {
    if (playerPool.length < 4) return null;

    const maxAllowedPartnerships = roundNumber <= 4 ? 0 : 1;

    // Try different combinations to avoid repeated partnerships (but allow some flexibility)
    for (let i = 0; i < playerPool.length - 3; i++) {
      for (let j = i + 1; j < playerPool.length - 2; j++) {
        const team1 = [playerPool[i], playerPool[j]];

        // Check if this partnership exceeds the allowed limit
        if (this.getPartnershipCount(team1[0], team1[1]) > maxAllowedPartnerships) {
          continue; // Skip this partnership
        }

        for (let k = 0; k < playerPool.length; k++) {
          if (k === i || k === j) continue;

          for (let l = k + 1; l < playerPool.length; l++) {
            if (l === i || l === j) continue;

            const team2 = [playerPool[k], playerPool[l]];

            // Check if this partnership exceeds the allowed limit
            if (this.getPartnershipCount(team2[0], team2[1]) > maxAllowedPartnerships) {
              continue; // Skip this partnership
            }

            // Try to create the game
            const game = this.createGameFromPlayers(team1, team2, roundNumber, court);
            if (game) {
              return game;
            }
          }
        }
      }
    }

    // If no valid partnerships found, return null
    return null;
  }

  /**
   * Create a game with the most relaxed constraints (last resort)
   */
  private createLastResortGame(playerPool: string[], roundNumber: number, court: number): Game | null {
    if (playerPool.length < 4) return null;

    // Just take the first 4 players without any partnership or skill constraints
    const team1 = [playerPool[0], playerPool[1]];
    const team2 = [playerPool[2], playerPool[3]];

    const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
    const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

    const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
    const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
    const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

    return {
      id: `game_${roundNumber}_${court}`,
      round: roundNumber,
      court,
      team1: [team1[0], team1[1]],
      team2: [team2[0], team2[1]],
      team1SkillLevel,
      team2SkillLevel,
      skillDifference
    };
  }
}
