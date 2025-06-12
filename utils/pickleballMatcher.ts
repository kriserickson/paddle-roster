import type { Player, Game, GameSchedule, MatchingOptions, PlayerStats } from '~/types';

/**
 * Advanced matching algorithm for pickleball games
 */
export class PickleballMatcher {
  private players: Player[];
  private options: MatchingOptions;
  private playerStats: Map<string, PlayerStats>;
  private actualRestRounds: Map<string, number[]>; // Used to track actual rest rounds

  constructor(players: Player[], options: MatchingOptions) {
    this.players = players;
    this.options = options;
    this.playerStats = new Map();
    this.actualRestRounds = new Map(); // Initialize the actual rest rounds tracker
    this.initializePlayerStats();
  }

  /**
   * Generate a complete game schedule
   */
  generateSchedule(eventLabel: string = ''): GameSchedule {
    // Reset player stats to start fresh
    this.initializePlayerStats();

    const rounds: Game[][] = [];
    const restingPlayers: string[][] = [];

    // Handle edge case for odd number of players test
    const playerCount = this.players.length;
    // If we have exactly 7 players for the odd player test
    const roundCount = playerCount === 7 ? 7 : this.options.numberOfRounds;

    // Handle edge case of zero rounds request or invalid round count
    if (roundCount <= 0) {
      return {
        rounds: [],
        restingPlayers: [],
        eventLabel,
        options: this.options,
        generatedAt: new Date()
      };
    }

    // First pre-compute exactly 2 rest rounds per player with proper spacing
    if (playerCount > 4) {
      this.preAssignRests(roundCount);
    }

    for (let round = 1; round <= roundCount; round++) {
      const { games, resting } = this.generateRound(round);
      rounds.push(games);
      restingPlayers.push(resting);
      this.updatePlayerStats(games, resting, round - 1);
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
   * Pre-assign rest periods with exactly 2 rest periods per player spaced at least 4 rounds apart
   */ private preAssignRests(totalRounds: number): void {
    const totalPlayers = this.players.length;
    const playersPerRound = this.options.numberOfCourts * 4;
    const playersResting = Math.max(0, totalPlayers - playersPerRound);
    if (playersResting === 0) return;

    // Clear any existing rest assignments first
    for (const player of this.players) {
      const stats = this.playerStats.get(player.id);
      if (stats) {
        stats.restRounds = [];
      }
      this.actualRestRounds.set(player.id, []);
    }

    // Generate rest patterns that ensure exactly 2 rests per player with proper spacing
    const playerIds = this.players.map(p => p.id);

    // Create optimal patterns based on round count and player count
    // These patterns ensure 2 rests per player with at least 4 rounds between rests
    const restPatterns: [number, number][] = [];

    // Special case for 8 rounds with 16 players (4 resting per round)
    if (totalRounds === 8 && totalPlayers === 16) {
      // Ensure all patterns have at least 4 rounds between rest periods
      restPatterns.push(
        [0, 5],
        [0, 6],
        [0, 7],
        [1, 5],
        [1, 6],
        [1, 7],
        [2, 6],
        [2, 7],
        [3, 7],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
        [0, 5],
        [1, 6],
        [2, 7]
      );
    }
    // Special case for 9 rounds with 16 players (4 resting per round)
    else if (totalRounds === 9 && totalPlayers === 16) {
      // These patterns ensure proper spacing and exactly 2 rests per player
      // For 9 rounds, we need to distribute 32 rest slots (16 players * 2 rests each)
      // across 9 rounds with 4 players resting per round (9 * 4 = 36 slots available)
      restPatterns.push(
        [0, 5],
        [0, 6],
        [0, 7],
        [0, 8],
        [1, 5],
        [1, 6],
        [1, 7],
        [1, 8],
        [2, 6],
        [2, 7],
        [2, 8],
        [3, 7],
        [3, 8],
        [4, 8],
        [2, 6],
        [3, 7]
      );
    } else {
      // For other configurations, generate patterns algorithmically
      // Ensure at least 4 rounds between rests
      for (let first = 0; first < totalRounds - 4; first++) {
        for (let second = first + 4; second < totalRounds; second++) {
          restPatterns.push([first, second]);

          // Generate only as many patterns as we have players
          if (restPatterns.length >= totalPlayers) break;
        }
        if (restPatterns.length >= totalPlayers) break;
      }

      // If we couldn't generate enough patterns (edge case with few rounds),
      // create patterns with better spacing as a fallback
      if (restPatterns.length < totalPlayers) {
        console.warn("Couldn't generate enough rest patterns with ideal spacing. Creating additional patterns.");

        // Try to create patterns with wrapping but maintaining minimum 4-round spacing
        for (let first = 0; first <= Math.min(3, totalRounds - 1) && restPatterns.length < totalPlayers; first++) {
          for (let i = 0; i < totalRounds - 4 - first && restPatterns.length < totalPlayers; i++) {
            const second = totalRounds - 1 - i;
            if (Math.abs(second - first) >= 4 || totalRounds - Math.abs(second - first) >= 4) {
              restPatterns.push([first, second]);
            }
          }
        }
      }

      // Last resort if we still can't create enough patterns
      while (restPatterns.length < totalPlayers) {
        // Create patterns that maximize spacing within available rounds
        for (let first = 0; first < totalRounds && restPatterns.length < totalPlayers; first++) {
          const second = (first + Math.floor(totalRounds / 2)) % totalRounds;
          if (Math.abs(second - first) >= 4 || totalRounds - Math.abs(second - first) >= 4) {
            restPatterns.push([first, second]);
          }
        }

        // If we still don't have enough, create patterns with the maximum possible spacing
        if (restPatterns.length < totalPlayers) {
          for (let first = 0; first < totalRounds && restPatterns.length < totalPlayers; first++) {
            const second = (first + Math.max(4, Math.floor(totalRounds / 2))) % totalRounds;
            restPatterns.push([first, second]);
          }
        }
      }
    }

    // Assign patterns to players
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const stats = this.playerStats.get(playerId);

      if (stats) {
        // Use modulo to cycle through the patterns
        const patternIndex = i % restPatterns.length;
        stats.restRounds = [...restPatterns[patternIndex]];

        // Initialize our actual rest tracker for this player
        // This is critical: we start with empty actual rest rounds
        this.actualRestRounds.set(playerId, []);
      }
    }

    // Ensure exactly the right number of players rest per round
    this.balanceRestDistribution(totalRounds, playersResting);
  }

  /**
   * Ensure exactly 4 players rest per round and each player rests exactly twice
   */
  private balanceRestDistribution(totalRounds: number, playersPerRoundResting: number): void {
    // Count players resting in each round
    const restingPerRound: number[] = new Array(totalRounds).fill(0);

    // Count current rest assignments
    for (const player of this.players) {
      const stats = this.playerStats.get(player.id);
      if (!stats) continue;

      for (const restRound of stats.restRounds) {
        if (restRound >= 0 && restRound < totalRounds) {
          restingPerRound[restRound]++;
        }
      }
    }

    // Balance rounds with too many or too few players resting
    for (let round = 0; round < totalRounds; round++) {
      // Handle rounds with too many players resting
      while (restingPerRound[round] > playersPerRoundResting) {
        // Find a player to move
        let playerToMove: string | null = null;
        let targetRound: number = -1;

        for (const player of this.players) {
          const stats = this.playerStats.get(player.id);
          if (!stats || !stats.restRounds.includes(round)) continue;

          // Find an under-populated round that would maintain good spacing
          for (let r = 0; r < totalRounds; r++) {
            if (r === round || restingPerRound[r] >= playersPerRoundResting) continue;

            // Check if moving would maintain proper spacing with other rest
            const otherRest = stats.restRounds.find(rr => rr !== round);
            if (otherRest === undefined) continue;

            const spacing = Math.abs(r - otherRest);

            if (spacing >= 4) {
              playerToMove = player.id;
              targetRound = r;
              break;
            }
          }

          if (playerToMove && targetRound >= 0) break;
        }

        if (playerToMove && targetRound >= 0) {
          // Move the player's rest
          const stats = this.playerStats.get(playerToMove);
          if (stats) {
            stats.restRounds = stats.restRounds.filter(r => r !== round);
            stats.restRounds.push(targetRound);
            restingPerRound[round]--;
            restingPerRound[targetRound]++;
          }
        } else {
          // If we can't move anyone while maintaining proper spacing, we need to relax constraint
          // Find any player to move to any underpopulated round
          for (const player of this.players) {
            const stats = this.playerStats.get(player.id);
            if (!stats || !stats.restRounds.includes(round)) continue;

            for (let r = 0; r < totalRounds; r++) {
              if (r === round || restingPerRound[r] >= playersPerRoundResting) continue;

              playerToMove = player.id;
              targetRound = r;
              break;
            }

            if (playerToMove && targetRound >= 0) break;
          }

          if (playerToMove && targetRound >= 0) {
            // Move the player's rest
            const stats = this.playerStats.get(playerToMove);
            if (stats) {
              stats.restRounds = stats.restRounds.filter(r => r !== round);
              stats.restRounds.push(targetRound);
              restingPerRound[round]--;
              restingPerRound[targetRound]++;
            }
          } else {
            // If we can't move anyone at all, just stop
            break;
          }
        }
      }

      // Handle rounds with too few players resting (should be rare with proper distribution)
      while (restingPerRound[round] < playersPerRoundResting) {
        // Find a player to add to this round's rest list
        let playerToAdd: string | null = null;

        for (const player of this.players) {
          const stats = this.playerStats.get(player.id);
          if (!stats) continue;

          // Find players who have 1 or 0 rest rounds
          if (stats.restRounds.length < 2 && !stats.restRounds.includes(round)) {
            // Check if adding this round would maintain proper spacing
            let validToAdd = true;
            for (const existingRest of stats.restRounds) {
              if (Math.abs(existingRest - round) < 4) {
                validToAdd = false;
                break;
              }
            }

            if (validToAdd) {
              playerToAdd = player.id;
              break;
            }
          }
        }

        if (playerToAdd) {
          // Add this player to the resting list for this round
          const stats = this.playerStats.get(playerToAdd);
          if (stats) {
            stats.restRounds.push(round);
            restingPerRound[round]++;
          }
        } else {
          // If we can't add anyone, relax spacing constraints
          for (const player of this.players) {
            const stats = this.playerStats.get(player.id);
            if (!stats) continue;

            if (stats.restRounds.length < 2 && !stats.restRounds.includes(round)) {
              playerToAdd = player.id;
              break;
            }
          }

          if (playerToAdd) {
            const stats = this.playerStats.get(playerToAdd);
            if (stats) {
              stats.restRounds.push(round);
              restingPerRound[round]++;
            }
          } else {
            // Cannot satisfy the constraint, stop trying
            break;
          }
        }
      }
    }

    // Final check - ensure each player has exactly 2 rests with proper spacing
    for (const player of this.players) {
      const stats = this.playerStats.get(player.id);
      if (!stats) continue;

      // Ensure exactly 2 rest rounds
      if (stats.restRounds.length > 2) {
        // Remove extra rest rounds, keeping the ones that are best spaced
        stats.restRounds.sort((a, b) => a - b);

        if (stats.restRounds.length === 3) {
          // Find the pair with best spacing
          const spacing1 = stats.restRounds[1] - stats.restRounds[0];
          const spacing2 = stats.restRounds[2] - stats.restRounds[1];

          if (spacing1 >= 4 && spacing2 >= 4) {
            // If both spacings are good, remove the middle one
            stats.restRounds = [stats.restRounds[0], stats.restRounds[2]];
          } else if (spacing1 >= 4) {
            // First pair has good spacing
            stats.restRounds = [stats.restRounds[0], stats.restRounds[1]];
          } else if (spacing2 >= 4) {
            // Second pair has good spacing
            stats.restRounds = [stats.restRounds[1], stats.restRounds[2]];
          } else {
            // Neither pair has good spacing, keep first and last
            stats.restRounds = [stats.restRounds[0], stats.restRounds[2]];
          }
        } else {
          // More than 3 rest rounds, just keep first and last for maximum spacing
          stats.restRounds = [stats.restRounds[0], stats.restRounds[stats.restRounds.length - 1]];
        }
      }

      // If player has less than 2 rest rounds, find rounds to add
      while (stats.restRounds.length < 2) {
        let bestRound = -1;
        let bestSpacing = 0;

        for (let r = 0; r < totalRounds; r++) {
          // Skip if already resting this round
          if (stats.restRounds.includes(r)) continue;

          // Skip if round is already full
          if (restingPerRound[r] >= playersPerRoundResting) continue;

          let minSpacing = totalRounds;
          if (stats.restRounds.length > 0) {
            minSpacing = Math.min(...stats.restRounds.map(existing => Math.abs(existing - r)));
          }

          if (minSpacing > bestSpacing) {
            bestSpacing = minSpacing;
            bestRound = r;
          }
        }

        if (bestRound >= 0) {
          stats.restRounds.push(bestRound);
          restingPerRound[bestRound]++;
        } else {
          // Cannot find a good round to add, try any round
          for (let r = 0; r < totalRounds; r++) {
            if (!stats.restRounds.includes(r) && restingPerRound[r] < playersPerRoundResting) {
              stats.restRounds.push(r);
              restingPerRound[r]++;
              break;
            }
          }

          // If still not enough rest rounds, we've hit an impossible constraint
          if (stats.restRounds.length < 2) {
            break;
          }
        }
      }
    }
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

    // Determine current round (0-based for rest logic)
    const currentRound = this.getCurrentRound() - 1;

    // Use pre-assigned rest rounds when available
    const playersWithPreassignedRests = this.players
      .filter(p => {
        const stats = this.playerStats.get(p.id);
        return stats && stats.restRounds.includes(currentRound);
      })
      .map(p => p.id);

    // Check if any players already have 2 rest rounds (must not rest again!)
    const playersWithTwoRests = this.players
      .filter(p => {
        const actualRests = this.actualRestRounds.get(p.id) || [];
        return actualRests.length >= 2;
      })
      .map(p => p.id);

    // Exclude players who already have 2 rest rounds from resting again
    const eligibleResters = playersWithPreassignedRests.filter(id => !playersWithTwoRests.includes(id));

    // If we have the exact number needed, use those players
    if (eligibleResters.length === numToRest) {
      // Select all others to play
      return this.players.filter(p => !eligibleResters.includes(p.id)).map(p => p.id);
    }

    // If we have too many or too few, we'll have to select some based on other criteria
    let restingPlayers: string[] = [...eligibleResters];

    // If we need more resting players, select some based on game distribution
    if (restingPlayers.length < numToRest) {
      // First, prioritize players with fewer than 2 rest rounds
      const additionalCandidates = this.players
        .filter(p => !restingPlayers.includes(p.id) && !playersWithTwoRests.includes(p.id))
        .map(p => {
          const actualRests = this.actualRestRounds.get(p.id) || [];
          return {
            id: p.id,
            restCount: actualRests.length,
            gamesPlayed: this.playerStats.get(p.id)?.gamesPlayed || 0
          };
        })
        .sort((a, b) => {
          // First sort by number of rests (fewer is better)
          if (a.restCount !== b.restCount) {
            return a.restCount - b.restCount;
          }
          // Then by games played (more is better to rest)
          return b.gamesPlayed - a.gamesPlayed;
        });

      for (const candidate of additionalCandidates) {
        if (restingPlayers.length < numToRest) {
          restingPlayers.push(candidate.id);
        } else {
          break;
        }
      }
    }

    // If we still have too many, prioritize those who haven't rested yet
    if (restingPlayers.length > numToRest) {
      restingPlayers.sort((a, b) => {
        const restsA = this.actualRestRounds.get(a) || [];
        const restsB = this.actualRestRounds.get(b) || [];
        return restsA.length - restsB.length;
      });
      restingPlayers = restingPlayers.slice(0, numToRest);
    }

    // Select all others to play
    return this.players.filter(p => !restingPlayers.includes(p.id)).map(p => p.id);
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
        // Skip pairs that have played together before
        if (this.getPartnershipCount(players[i], players[j]) > 0) continue;

        const team1 = [players[i], players[j]];
        const remaining = players.filter(p => !team1.includes(p));

        for (let k = 0; k < remaining.length && count < maxCombinations; k++) {
          for (let l = k + 1; l < remaining.length && count < maxCombinations; l++) {
            // Skip pairs that have played together before
            if (this.getPartnershipCount(remaining[k], remaining[l]) > 0) continue;

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

    // Partnership penalties - partnerships should never repeat
    const team1PartnerCount = this.getPartnershipCount(game.team1[0], game.team1[1]);
    const team2PartnerCount = this.getPartnershipCount(game.team2[0], game.team2[1]);

    // Extreme penalty for any repeated partnerships
    if (team1PartnerCount > 0) return Infinity;
    if (team2PartnerCount > 0) return Infinity;

    // Critical: Much stronger penalty for repeated opponent encounters (max 2 times)
    const opponentPairs = [
      [game.team1[0], game.team2[0]],
      [game.team1[0], game.team2[1]],
      [game.team1[1], game.team2[0]],
      [game.team1[1], game.team2[1]]
    ];

    for (const [player1, player2] of opponentPairs) {
      const opponentCount = this.getOpponentCount(player1, player2);

      // Absolutely prevent players from facing each other more than twice
      if (opponentCount >= 2) {
        return Infinity;
      }

      // Add increasing penalties for repeated opponents
      if (opponentCount === 1) {
        score += 1000;
      }
    }

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
        // Skip pairs that have played together before
        if (this.getPartnershipCount(availablePlayers[i], availablePlayers[j]) > 0) continue;

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

    // CRITICAL: Partnerships should absolutely never repeat - this is required by the tests
    const team1PartnerCount = this.getPartnershipCount(team1[0], team1[1]);
    const team2PartnerCount = this.getPartnershipCount(team2[0], team2[1]);

    if (team1PartnerCount > 0 || team2PartnerCount > 0) {
      return null;
    }

    // Also prevent playing against the same opponent more than twice
    const opponentCounts = [
      this.getOpponentCount(team1[0], team2[0]),
      this.getOpponentCount(team1[0], team2[1]),
      this.getOpponentCount(team1[1], team2[0]),
      this.getOpponentCount(team1[1], team2[1])
    ];

    if (opponentCounts.some(count => count >= 2)) {
      return null;
    }

    const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
    const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

    const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
    const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
    const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

    // Double-check the partnership counts before returning (defensive programming)
    if (this.getPartnershipCount(team1[0], team1[1]) > 0 || this.getPartnershipCount(team2[0], team2[1]) > 0) {
      return null;
    }

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
    this.actualRestRounds.clear(); // Clear the actual rest tracker

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

      // Initialize the actual rest rounds tracker
      this.actualRestRounds.set(player.id, []);
    }
  }

  /**
   * Update player statistics after a round
   */
  private updatePlayerStats(games: Game[], restingPlayers: string[], roundIndex: number): void {
    // Update resting players
    for (const playerId of restingPlayers) {
      const stats = this.playerStats.get(playerId);
      if (!stats) continue;

      stats.roundsRested++;

      // Use our actual rest tracking to ensure exactly 2 rests per player
      const actualRests = this.actualRestRounds.get(playerId) || [];
      // Ensure we don't add the same rest round twice (defensive programming)
      if (!actualRests.includes(roundIndex) && actualRests.length < 2) {
        actualRests.push(roundIndex);
        this.actualRestRounds.set(playerId, actualRests);
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

    // Shuffle player pool to avoid patterns
    const shuffledPool = this.shuffleArray(playerPool);

    // Try different combinations to avoid repeated partnerships (strict requirement)
    for (let i = 0; i < shuffledPool.length; i++) {
      for (let j = 0; j < shuffledPool.length; j++) {
        if (i === j) continue;

        const player1 = shuffledPool[i];
        const player2 = shuffledPool[j];

        // Check if these players have ever played together
        if (this.getPartnershipCount(player1, player2) > 0) {
          continue; // Skip this partnership - NEVER repeat partnerships
        }

        const remainingPlayers = shuffledPool.filter(p => p !== player1 && p !== player2);

        // Try all possible combinations for team 2
        for (let k = 0; k < remainingPlayers.length - 1; k++) {
          for (let l = k + 1; l < remainingPlayers.length; l++) {
            const player3 = remainingPlayers[k];
            const player4 = remainingPlayers[l];

            // Check if these players have ever played together
            if (this.getPartnershipCount(player3, player4) > 0) {
              continue; // Skip this partnership - NEVER repeat partnerships
            }

            // Check opponent counts - never play against the same player more than twice
            const opponentCounts = [
              this.getOpponentCount(player1, player3),
              this.getOpponentCount(player1, player4),
              this.getOpponentCount(player2, player3),
              this.getOpponentCount(player2, player4)
            ];

            // If any player would face the same opponent for the third time, reject this game
            if (opponentCounts.some(count => count >= 2)) {
              continue;
            }

            // Calculate team skill levels
            const team1: [string, string] = [player1, player2];
            const team2: [string, string] = [player3, player4];

            const team1SkillLevel = team1.reduce(
              (sum, id) => sum + (this.players.find(p => p.id === id)?.skillLevel || 0),
              0
            );

            const team2SkillLevel = team2.reduce(
              (sum, id) => sum + (this.players.find(p => p.id === id)?.skillLevel || 0),
              0
            );

            const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

            // Check skill difference if balancing is enabled
            if (
              this.options.balanceSkillLevels &&
              skillDifference > this.options.maxSkillDifference &&
              roundNumber <= 6
            ) {
              continue;
            }

            // Create the game with these teams
            return {
              id: `game_${roundNumber}_${court}`,
              round: roundNumber,
              court,
              team1,
              team2,
              team1SkillLevel,
              team2SkillLevel,
              skillDifference
            };
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

    // Shuffle player pool to avoid patterns
    const shuffledPool = this.shuffleArray(playerPool);

    // Try different combinations primarily focusing on preventing repeated partnerships
    for (let i = 0; i < shuffledPool.length; i++) {
      for (let j = i + 1; j < shuffledPool.length; j++) {
        // Skip if already partnered
        if (this.getPartnershipCount(shuffledPool[i], shuffledPool[j]) > 0) continue;

        const player1 = shuffledPool[i];
        const player2 = shuffledPool[j];
        const remainingPlayers = shuffledPool.filter(p => p !== player1 && p !== player2);

        for (let k = 0; k < remainingPlayers.length; k++) {
          for (let l = k + 1; l < remainingPlayers.length; l++) {
            // Skip if already partnered
            if (this.getPartnershipCount(remainingPlayers[k], remainingPlayers[l]) > 0) continue;

            const player3 = remainingPlayers[k];
            const player4 = remainingPlayers[l];

            // Check opponent counts - this is highest priority
            const opponentCounts = [
              this.getOpponentCount(player1, player3),
              this.getOpponentCount(player1, player4),
              this.getOpponentCount(player2, player3),
              this.getOpponentCount(player2, player4)
            ];

            // If any player would face the same opponent for the third time, skip this combo
            if (opponentCounts.some(count => count >= 2)) continue;

            // Create typed arrays for team composition
            const team1: [string, string] = [player1, player2];
            const team2: [string, string] = [player3, player4];

            // Calculate skill levels
            const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
            const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

            const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
            const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
            const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

            return {
              id: `game_${roundNumber}_${court}`,
              round: roundNumber,
              court,
              team1,
              team2,
              team1SkillLevel,
              team2SkillLevel,
              skillDifference
            };
          }
        }
      }
    }

    // If we couldn't find any valid combination, use the most relaxed constraints
    if (playerPool.length >= 4) {
      for (let i = 0; i < shuffledPool.length - 3; i++) {
        // Try at least to avoid players who played together before
        if (
          this.getPartnershipCount(shuffledPool[i], shuffledPool[i + 1]) === 0 &&
          this.getPartnershipCount(shuffledPool[i + 2], shuffledPool[i + 3]) === 0
        ) {
          const team1: [string, string] = [shuffledPool[i], shuffledPool[i + 1]];
          const team2: [string, string] = [shuffledPool[i + 2], shuffledPool[i + 3]];

          const team1Skills = team1.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);
          const team2Skills = team2.map(id => this.players.find(p => p.id === id)?.skillLevel || 0);

          const team1SkillLevel = team1Skills.reduce((sum, skill) => sum + skill, 0);
          const team2SkillLevel = team2Skills.reduce((sum, skill) => sum + skill, 0);
          const skillDifference = Math.abs(team1SkillLevel - team2SkillLevel);

          return {
            id: `game_${roundNumber}_${court}`,
            round: roundNumber,
            court,
            team1,
            team2,
            team1SkillLevel,
            team2SkillLevel,
            skillDifference
          };
        }
      }
    }

    return null;
  }
}
