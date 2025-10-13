import type { Player, Game, MatchingOptions, GameSchedule } from '~/types';

/**
 * PickleballMatcher - Greedy constructive algorithm with local optimization
 * Builds schedules round-by-round using heuristics, then improves with local search
 */
export class PickleballMatcher {
  constructor(
    private players: Player[],
    private opts: MatchingOptions
  ) {
    // no-op
  }

  /**
   * Generate the best schedule using greedy construction + local optimization.
   */
  public async generateSchedule(eventLabel: string = ''): Promise<GameSchedule> {
    const activePlayers = this.players.filter(p => p.active !== false);
    const iterations = 1500;

    let bestSchedule: GameSchedule | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    // Try multiple random starting points
    for (let i = 0; i < iterations; i++) {
      const schedule = this.buildScheduleGreedy(eventLabel, activePlayers);
      const score = this.evaluateScore(schedule);
      schedule.score = score;

      if (score < bestScore) {
        bestScore = score;
        bestSchedule = schedule;
      }

      // Yield control every 100 iterations to prevent blocking the UI
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (!bestSchedule) {
      throw new Error('Failed to generate schedule');
    }

    return bestSchedule;
  }

  /**
   * Build a schedule greedily, round by round.
   */
  private buildScheduleGreedy(eventLabel: string, players: Player[]): GameSchedule {
    const playerIds = players.map(p => p.id);
    const sittersPerRound = playerIds.length - this.opts.numberOfCourts * 4;

    // Build rest schedule first (who sits out each round)
    const restMatrix = this.buildRestSchedule(playerIds, sittersPerRound, this.opts.firstRoundSitters);

    // Build games for each round
    const rounds: Game[][] = [];
    const partnerHistory: Record<string, Set<string>> = {};
    const opponentHistory: Record<string, Record<string, number>> = {};
    const courtHistory: Record<string, number[]> = {};

    // Initialize history
    for (const pid of playerIds) {
      partnerHistory[pid] = new Set();
      opponentHistory[pid] = {};
      courtHistory[pid] = [];
    }

    for (let roundNum = 0; roundNum < this.opts.numberOfRounds; roundNum++) {
      const restingPlayers = new Set(restMatrix[roundNum]);
      const playingPlayers = playerIds.filter(id => !restingPlayers.has(id));

      const games = this.buildRoundGames(roundNum + 1, playingPlayers, partnerHistory, opponentHistory, courtHistory);

      rounds.push(games);

      // Update history
      for (const game of games) {
        const [a1, a2] = game.team1;
        const [b1, b2] = game.team2;

        // Partners
        partnerHistory[a1].add(a2);
        partnerHistory[a2].add(a1);
        partnerHistory[b1].add(b2);
        partnerHistory[b2].add(b1);

        // Opponents
        for (const p1 of [a1, a2]) {
          for (const p2 of [b1, b2]) {
            opponentHistory[p1][p2] = (opponentHistory[p1][p2] || 0) + 1;
            opponentHistory[p2][p1] = (opponentHistory[p2][p1] || 0) + 1;
          }
        }

        // Courts
        for (const pid of [a1, a2, b1, b2]) {
          courtHistory[pid].push(game.court);
        }
      }
    }

    const schedule = {
      rounds,
      restingPlayers: restMatrix,
      eventLabel,
      options: this.opts,
      generatedAt: new Date()
    };

    return schedule;
  }

  /**
   * Build rest schedule ensuring even distribution and spacing.
   * Priority: Even distribution > Max spacing between rests
   */
  private buildRestSchedule(
    playerIds: string[],
    sittersPerRound: number,
    firstRoundSitters?: readonly string[]
  ): string[][] {
    if (sittersPerRound <= 0) {
      return Array.from({ length: this.opts.numberOfRounds }, () => []);
    }

    const rounds = this.opts.numberOfRounds;
    const restMatrix: string[][] = [];
    const restCounts: Record<string, number> = {};
    const lastRestRound: Record<string, number> = {};

    // Initialize
    for (const pid of playerIds) {
      restCounts[pid] = 0;
      lastRestRound[pid] = -100; // Far in the past
    }

    // Calculate target rests per player (used when distributeRestEqually is enabled)
    const totalRestSlots = rounds * sittersPerRound;
    const avgRestsPerPlayer = totalRestSlots / playerIds.length;

    for (let r = 0; r < rounds; r++) {
      let sitters: string[];

      if (r === 0 && firstRoundSitters && firstRoundSitters.length > 0) {
        // Use specified first round sitters (if any), and fill remaining slots
        const specifiedSitters = [...firstRoundSitters];

        // Update rest counts for specified sitters
        for (const pid of specifiedSitters) {
          restCounts[pid]++;
          lastRestRound[pid] = r;
        }

        if (specifiedSitters.length < sittersPerRound) {
          // Need to select additional sitters
          const remainingSlots = sittersPerRound - specifiedSitters.length;
          const availablePlayers = playerIds.filter(pid => !specifiedSitters.includes(pid));

          const additionalSitters = this.selectSittersForRound(
            availablePlayers,
            remainingSlots,
            r,
            restCounts,
            lastRestRound,
            avgRestsPerPlayer
          );

          sitters = [...specifiedSitters, ...additionalSitters];
        } else {
          sitters = specifiedSitters;
        }
      } else {
        // Select sitters greedily
        sitters = this.selectSittersForRound(
          playerIds,
          sittersPerRound,
          r,
          restCounts,
          lastRestRound,
          avgRestsPerPlayer
        );
      }

      restMatrix.push(sitters);
    }

    return restMatrix;
  }

  /**
   * Select sitters for a round using greedy heuristic.
   */
  private selectSittersForRound(
    playerIds: string[],
    sittersPerRound: number,
    currentRound: number,
    restCounts: Record<string, number>,
    lastRestRound: Record<string, number>,
    avgRestsPerPlayer: number
  ): string[] {
    // Score each player for sitting (higher = better to sit)
    const scores: Array<{ id: string; score: number }> = playerIds.map(pid => {
      let score = 0;

      // Priority 1: Even distribution - players who need more rest (below average)
      if (this.opts.distributeRestEqually) {
        const restDeficit = avgRestsPerPlayer - restCounts[pid];
        score += restDeficit * 1000;
      }

      // Priority 2: Players who haven't rested recently (spacing)
      const roundsSinceRest = currentRound - lastRestRound[pid];
      score += roundsSinceRest * 10;

      // Add small random component for tie-breaking
      score += Math.random() * 0.1;

      return { id: pid, score };
    });

    // Sort by score and take top N
    scores.sort((a, b) => b.score - a.score);
    const selected = scores.slice(0, sittersPerRound).map(s => s.id);

    // Update counts
    for (const pid of selected) {
      restCounts[pid]++;
      lastRestRound[pid] = currentRound;
    }

    return selected;
  }

  /**
   * Build games for a single round.
   */
  private buildRoundGames(
    roundNum: number,
    playingPlayers: string[],
    partnerHistory: Record<string, Set<string>>,
    opponentHistory: Record<string, Record<string, number>>,
    courtHistory: Record<string, number[]>
  ): Game[] {
    const games: Game[] = [];

    // Validate we have the right number of players
    const expectedPlayers = this.opts.numberOfCourts * 4;
    if (playingPlayers.length !== expectedPlayers) {
      throw new Error(`Round ${roundNum}: Expected ${expectedPlayers} players but got ${playingPlayers.length}`);
    }

    // Create pairs (teams)
    const pairs = this.createPairsGreedy(playingPlayers, partnerHistory);

    // Validate we have the right number of pairs
    const expectedPairs = this.opts.numberOfCourts * 2;
    if (pairs.length !== expectedPairs) {
      console.error(
        `Round ${roundNum}: Expected ${expectedPairs} pairs but got ${pairs.length}. Players: ${playingPlayers.length}`
      );
      // This is a critical error - we can't proceed
      throw new Error(`Failed to create correct number of pairs for round ${roundNum}`);
    }

    // Match pairs against each other
    const matchings = this.matchPairsGreedy(pairs, opponentHistory);

    // Validate we have the right number of matchings
    const expectedMatchings = this.opts.numberOfCourts;
    if (matchings.length !== expectedMatchings) {
      console.error(
        `Round ${roundNum}: Expected ${expectedMatchings} matchings but got ${matchings.length}. Pairs: ${pairs.length}`
      );
      // This is a critical error - we can't proceed
      throw new Error(`Failed to create correct number of matchings for round ${roundNum}`);
    }

    // Assign to courts
    const courtAssignments = this.assignCourtsGreedy(matchings, courtHistory, roundNum);

    // Create game objects
    for (let i = 0; i < courtAssignments.length; i++) {
      const { team1, team2, court } = courtAssignments[i];

      // Validate teams have players
      if (!team1[0] || !team1[1] || !team2[0] || !team2[1]) {
        console.error(`Round ${roundNum}, Court ${court}: Invalid team composition`, { team1, team2 });
        throw new Error(`Invalid team composition in round ${roundNum}`);
      }

      const skillLevel1 = this.player(team1[0]).skillLevel + this.player(team1[1]).skillLevel;
      const skillLevel2 = this.player(team2[0]).skillLevel + this.player(team2[1]).skillLevel;

      games.push({
        id: `g-${roundNum}-${court}`,
        round: roundNum,
        court,
        team1,
        team2,
        team1SkillLevel: skillLevel1,
        team2SkillLevel: skillLevel2,
        skillDifference: Math.abs(skillLevel1 - skillLevel2)
      });
    }

    return games;
  }

  /**
   * Create pairs greedily, avoiding recent partners.
   */
  private createPairsGreedy(players: string[], partnerHistory: Record<string, Set<string>>): string[][] {
    const pairs: string[][] = [];
    const available = [...players];
    const shuffled = this.shuffleArray(available);

    while (shuffled.length >= 2) {
      const p1 = shuffled.shift()!;

      // Find best partner for p1 (prefer someone they haven't played with)
      let bestPartner: string | null = null;
      let bestScore = -Infinity;

      for (let i = 0; i < shuffled.length; i++) {
        const p2 = shuffled[i];
        let score = 0;

        // Prefer new partners
        if (!partnerHistory[p1].has(p2)) {
          score += 1000; // Much higher weight for new partners
        } else {
          score -= 500; // Heavy penalty for repeats
        }

        // Consider skill balance if enabled
        if (this.opts.balanceSkillLevels) {
          const skill1 = this.player(p1).skillLevel;
          const skill2 = this.player(p2).skillLevel;
          const avgSkill = (skill1 + skill2) / 2;
          // Prefer pairs with mid-range combined skill
          score += (3.5 - Math.abs(avgSkill - 3.5)) * 10;
        }

        // Respect partner preferences if enabled
        if (this.opts.respectPartnerPreferences) {
          const player1 = this.player(p1);
          const player2 = this.player(p2);
          if (player1.partnerId === p2 || player2.partnerId === p1) {
            score += 200;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestPartner = p2;
        }
      }

      if (bestPartner) {
        pairs.push([p1, bestPartner]);
        shuffled.splice(shuffled.indexOf(bestPartner), 1);
      } else if (shuffled.length > 0) {
        // Force pairing with first available if no best partner found
        const forcedPartner = shuffled.shift()!;
        pairs.push([p1, forcedPartner]);
      }
    }

    return pairs;
  }

  /**
   * Match pairs against each other, avoiding recent opponents.
   */
  private matchPairsGreedy(
    pairs: string[][],
    opponentHistory: Record<string, Record<string, number>>
  ): Array<{ team1: [string, string]; team2: [string, string] }> {
    const matchings: Array<{ team1: [string, string]; team2: [string, string] }> = [];
    const available = [...pairs];

    while (available.length >= 2) {
      const team1 = available.shift()!;

      // Find best opponent team
      let bestOpponent: string[] | null = null;
      let bestScore = -Infinity;
      let hasValidOpponent = false;

      // First pass: try to find opponent that meets all constraints
      for (let i = 0; i < available.length; i++) {
        const team2 = available[i];
        let score = 0;

        // Calculate skill difference
        const skill1 = team1.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
        const skill2 = team2.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
        const skillDiff = Math.abs(skill1 - skill2);

        // Enforce maxSkillDifference constraint if balancing is enabled
        if (this.opts.balanceSkillLevels && skillDiff > this.opts.maxSkillDifference) {
          // Skip this pairing - it violates the max skill difference constraint
          continue;
        }

        hasValidOpponent = true;

        // Count how many times these players have faced each other
        let opponentCount = 0;
        for (const p1 of team1) {
          for (const p2 of team2) {
            opponentCount += opponentHistory[p1][p2] || 0;
          }
        }

        // Strongly prefer new opponents
        score -= opponentCount * 200;

        // Consider skill balance
        if (this.opts.balanceSkillLevels) {
          score -= skillDiff * 20;
        }

        if (score > bestScore) {
          bestScore = score;
          bestOpponent = team2;
        }
      }

      // If no valid opponent found (all violate maxSkillDifference), relax constraint
      if (!hasValidOpponent && available.length > 0) {
        bestOpponent = null;
        bestScore = -Infinity;

        // Second pass: ignore maxSkillDifference constraint to ensure all teams get matched
        for (let i = 0; i < available.length; i++) {
          const team2 = available[i];
          let score = 0;

          const skill1 = team1.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
          const skill2 = team2.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
          const skillDiff = Math.abs(skill1 - skill2);

          // Count how many times these players have faced each other
          let opponentCount = 0;
          for (const p1 of team1) {
            for (const p2 of team2) {
              opponentCount += opponentHistory[p1][p2] || 0;
            }
          }

          // Prefer new opponents
          score -= opponentCount * 200;

          // Prefer smaller skill differences even if over the limit
          score -= skillDiff * 20;

          if (score > bestScore) {
            bestScore = score;
            bestOpponent = team2;
          }
        }
      }

      if (bestOpponent) {
        matchings.push({
          team1: [team1[0], team1[1]],
          team2: [bestOpponent[0], bestOpponent[1]]
        });
        available.splice(available.indexOf(bestOpponent), 1);
      } else if (available.length > 0) {
        // This should never happen, but if it does, force a match with the first available team
        const forcedOpponent = available.shift()!;
        matchings.push({
          team1: [team1[0], team1[1]],
          team2: [forcedOpponent[0], forcedOpponent[1]]
        });
      }
    }

    return matchings;
  }

  /**
   * Assign games to courts, balancing court usage.
   * Ensures each court is used exactly once per round.
   */
  private assignCourtsGreedy(
    matchings: Array<{ team1: [string, string]; team2: [string, string] }>,
    courtHistory: Record<string, number[]>,
    _roundNum: number
  ): Array<{ team1: [string, string]; team2: [string, string]; court: number }> {
    const assignments: Array<{ team1: [string, string]; team2: [string, string]; court: number }> = [];
    const usedCourts = new Set<number>();

    for (let i = 0; i < matchings.length; i++) {
      const { team1, team2 } = matchings[i];
      let bestCourt = 1;
      let bestScore = -Infinity;

      for (let court = 1; court <= this.opts.numberOfCourts; court++) {
        // Skip courts already used in this round
        if (usedCourts.has(court)) {
          continue;
        }

        let score = 0;

        // Count how many times these players have played on this court
        for (const pid of [...team1, ...team2]) {
          const history = courtHistory[pid];
          const courtCount = history.filter(c => c === court).length;
          score -= courtCount * 10;

          // Add extra penalty for playing on the same court in the last round (consecutive rounds)
          if (history.length > 0) {
            const lastCourt = history[history.length - 1];
            if (lastCourt === court) {
              score -= 50; // Heavy penalty for consecutive rounds on same court
            }
          }

          // Add moderate penalty for playing on the same court in the last 2 rounds
          if (history.length > 1) {
            const secondLastCourt = history[history.length - 2];
            if (secondLastCourt === court) {
              score -= 20; // Moderate penalty for recent play on same court
            }
          }
        }

        // Add randomness for tie-breaking
        score += Math.random();

        if (score > bestScore) {
          bestScore = score;
          bestCourt = court;
        }
      }

      // Mark this court as used in this round
      usedCourts.add(bestCourt);
      assignments.push({ team1, team2, court: bestCourt });
    }

    return assignments;
  }

  /**
   * Evaluate schedule with prioritized scoring.
   */
  private evaluateScore(schedule: GameSchedule): number {
    let score = 0;

    // PRIORITY 0: First round sitters must be respected (if specified)
    // This is enforced during construction, so we don't penalize here

    // PRIORITY 1: Even rest distribution (max difference of 1) - if enabled
    if (this.opts.distributeRestEqually) {
      score += this.scoreRestDistribution(schedule) * 10000;
    }

    // PRIORITY 2: Rest spacing (maximize distance between rests)
    score += this.scoreRestSpacing(schedule) * 1000;

    // PRIORITY 3: Minimize partner repeats
    score += this.scorePartnerRepeats(schedule) * 100;

    // PRIORITY 4: Minimize opponent repeats
    score += this.scoreOpponentRepeats(schedule) * 50;

    // PRIORITY 5: Balance court usage
    score += this.scoreCourtBalance(schedule) * 10;

    // PRIORITY 6: Skill level balance (if enabled)
    if (this.opts.balanceSkillLevels) {
      score += this.scoreSkillBalance(schedule) * 5;
      // Add penalty for games exceeding maxSkillDifference
      score += this.scoreMaxSkillDifferenceViolations(schedule) * 100;
    }

    // PRIORITY 7: Couples play together (if enabled)
    if (this.opts.respectPartnerPreferences) {
      score += this.scoreCouplesPreference(schedule) * 1;
    }

    return score;
  }

  private scoreRestDistribution(schedule: GameSchedule): number {
    const restCounts: Record<string, number> = {};
    const players = this.players.filter(p => p.active !== false);

    for (const player of players) {
      restCounts[player.id] = 0;
    }

    for (const roundRests of schedule.restingPlayers) {
      for (const pid of roundRests) {
        restCounts[pid]++;
      }
    }

    const counts = Object.values(restCounts);
    const min = Math.min(...counts);
    const max = Math.max(...counts);

    return max - min; // 0 = perfect, higher = worse
  }

  private scoreRestSpacing(schedule: GameSchedule): number {
    const players = this.players.filter(p => p.active !== false);
    let totalBadness = 0;

    for (const player of players) {
      const restRounds: number[] = [];
      schedule.restingPlayers.forEach((rests, roundIdx) => {
        if (rests.includes(player.id)) {
          restRounds.push(roundIdx);
        }
      });

      if (restRounds.length > 1) {
        // Calculate spacing variance (prefer even spacing)
        const gaps: number[] = [];
        for (let i = 1; i < restRounds.length; i++) {
          gaps.push(restRounds[i] - restRounds[i - 1]);
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
        totalBadness += variance;
      }
    }

    return totalBadness;
  }

  private scorePartnerRepeats(schedule: GameSchedule): number {
    const partnerCounts: Record<string, number> = {};

    for (const round of schedule.rounds) {
      for (const game of round) {
        this.bump(partnerCounts, game.team1[0], game.team1[1]);
        this.bump(partnerCounts, game.team2[0], game.team2[1]);
      }
    }

    let penalty = 0;
    for (const count of Object.values(partnerCounts)) {
      if (count > 1) {
        penalty += Math.pow(2, count - 1);
      }
    }

    return penalty;
  }

  private scoreOpponentRepeats(schedule: GameSchedule): number {
    const opponentCounts: Record<string, number> = {};

    for (const round of schedule.rounds) {
      for (const game of round) {
        for (const p1 of game.team1) {
          for (const p2 of game.team2) {
            this.bump(opponentCounts, p1, p2);
          }
        }
      }
    }

    let penalty = 0;
    for (const count of Object.values(opponentCounts)) {
      if (count > 2) {
        penalty += Math.pow(2, count - 2);
      }
    }

    return penalty;
  }

  private scoreCourtBalance(schedule: GameSchedule): number {
    const courtCounts: Record<string, Record<number, number>> = {};
    const players = this.players.filter(p => p.active !== false);

    for (const player of players) {
      courtCounts[player.id] = {};
    }

    for (const round of schedule.rounds) {
      for (const game of round) {
        for (const pid of [...game.team1, ...game.team2]) {
          courtCounts[pid][game.court] = (courtCounts[pid][game.court] || 0) + 1;
        }
      }
    }

    let penalty = 0;
    for (const pid in courtCounts) {
      const counts = Object.values(courtCounts[pid]);
      if (counts.length > 0) {
        const max = Math.max(...counts);
        const min = Math.min(...counts, 0);
        penalty += (max - min) * (max - min);
      }
    }

    return penalty;
  }

  private scoreSkillBalance(schedule: GameSchedule): number {
    let totalImbalance = 0;

    for (const round of schedule.rounds) {
      for (const game of round) {
        totalImbalance += game.skillDifference;
      }
    }

    return totalImbalance;
  }

  private scoreMaxSkillDifferenceViolations(schedule: GameSchedule): number {
    let violations = 0;

    for (const round of schedule.rounds) {
      for (const game of round) {
        if (game.skillDifference > this.opts.maxSkillDifference) {
          // Exponential penalty for violations
          const excess = game.skillDifference - this.opts.maxSkillDifference;
          violations += Math.pow(2, excess);
        }
      }
    }

    return violations;
  }

  private scoreCouplesPreference(schedule: GameSchedule): number {
    const couplesPlayed: Record<string, boolean> = {};
    const players = this.players.filter(p => p.active !== false);

    // Find all couples
    for (const player of players) {
      if (player.partnerId) {
        const key = this.pairKey(player.id, player.partnerId);
        couplesPlayed[key] = false;
      }
    }

    // Check if couples played together
    for (const round of schedule.rounds) {
      for (const game of round) {
        const key1 = this.pairKey(game.team1[0], game.team1[1]);
        const key2 = this.pairKey(game.team2[0], game.team2[1]);

        if (key1 in couplesPlayed) {
          couplesPlayed[key1] = true;
        }
        if (key2 in couplesPlayed) {
          couplesPlayed[key2] = true;
        }
      }
    }

    // Penalize couples who didn't play together
    let penalty = 0;
    for (const played of Object.values(couplesPlayed)) {
      if (!played) {
        penalty += 100;
      }
    }

    return penalty;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Helper utilities
  private player(id: string): Player {
    const p = this.players.find(x => {
      return x.id === id;
    });
    if (!p) {
      throw new Error(`Unknown player id ${id}`);
    }
    return p;
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private bump(store: Record<string, number>, a: string, b: string): void {
    const k = this.pairKey(a, b);
    if (!store[k]) {
      store[k] = 0;
    }
    store[k] += 1;
  }
}
