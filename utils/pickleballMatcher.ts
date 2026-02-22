import type { Game, GameSchedule, MatchingOptions, Player } from '~/types';

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

  private preferenceMultiplier(level: 'relaxed' | 'balanced' | 'strict' | undefined): number {
    if (level === 'relaxed') {
      return 0.7;
    }
    if (level === 'strict') {
      return 1.5;
    }
    return 1.0;
  }

  /**
   * Generate the best schedule using greedy construction + local optimization.
   */
  public async generateSchedule(eventLabel: string = ''): Promise<GameSchedule> {
    const activePlayers = this.players.filter(p => p.active !== false);
    // Small player pools with many rounds are harder — give them more search budget.
    // 2-court pools use exhaustive per-round construction (315 arrangements evaluated vs ~6
    // greedy), so each iteration is ~20× richer; fewer iterations are needed.
    const sittersPerRound = activePlayers.length - this.opts.numberOfCourts * 4;
    const isHighDensity = sittersPerRound <= 2 && this.opts.numberOfRounds >= 10;
    const usesExhaustive = sittersPerRound <= 2 && this.opts.numberOfCourts === 2;
    // Large pools (≥14 players) have ample natural variety; 1000 iterations is sufficient.
    // Medium pools (10-13 players, non-exhaustive) need 1500 to find good schedules reliably.
    const isLargePool = activePlayers.length >= 14;
    const iterations = usesExhaustive ? 1000 : isHighDensity ? 2500 : isLargePool ? 1000 : 1500;

    let bestSchedule: GameSchedule | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    // Try multiple random starting points
    for (let i = 0; i < iterations; i++) {
      const schedule = this.buildScheduleGreedy(eventLabel, activePlayers, i);
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

    // Apply local search to improve the best schedule found
    bestSchedule = this.improveWithLocalSearch(bestSchedule);

    // Targeted repair for hot opponent pairs (pairs that faced each other 3+ times)
    bestSchedule = this.repairHotOpponentPairs(bestSchedule);

    return bestSchedule;
  }

  /**
   * Build a schedule greedily, round by round.
   * Rest assignments are interleaved with game building so that accumulated
   * opponent history can inform smarter sitting decisions.
   */
  private buildScheduleGreedy(eventLabel: string, players: Player[], seed: number): GameSchedule {
    const playerIds = players.map(p => p.id);
    const sittersPerRound = playerIds.length - this.opts.numberOfCourts * 4;

    // Build games and rest assignments round-by-round (dynamic rest scheduling)
    const rounds: Game[][] = [];
    const restMatrix: string[][] = [];
    const partnerHistory: Record<string, Record<string, number>> = {};
    const opponentHistory: Record<string, Record<string, number>> = {};
    const recentOpponentHistory: Record<string, string[][]> = {};
    const courtHistory: Record<string, number[]> = {};

    // Rest tracking state (built incrementally)
    const restCounts: Record<string, number> = {};
    const lastRestRound: Record<string, number> = {};

    // Initialize history
    for (const pid of playerIds) {
      partnerHistory[pid] = {};
      opponentHistory[pid] = {};
      recentOpponentHistory[pid] = [];
      courtHistory[pid] = [];
      restCounts[pid] = 0;
      lastRestRound[pid] = -100;
    }

    const totalRestSlots = this.opts.numberOfRounds * Math.max(0, sittersPerRound);
    const avgRestsPerPlayer = playerIds.length > 0 ? totalRestSlots / playerIds.length : 0;

    for (let roundNum = 0; roundNum < this.opts.numberOfRounds; roundNum++) {
      // Select sitters for this round using accumulated opponent history
      let roundSitters: string[];

      if (sittersPerRound <= 0) {
        roundSitters = [];
      } else if (roundNum === 0 && this.opts.firstRoundSitters && this.opts.firstRoundSitters.length > 0) {
        const specifiedSitters = [...this.opts.firstRoundSitters];
        for (const pid of specifiedSitters) {
          restCounts[pid] = (restCounts[pid] || 0) + 1;
          lastRestRound[pid] = roundNum;
        }
        if (specifiedSitters.length < sittersPerRound) {
          const remaining = sittersPerRound - specifiedSitters.length;
          const available = playerIds.filter(pid => !specifiedSitters.includes(pid));
          const extra = this.selectSittersForRound(
            available,
            remaining,
            roundNum,
            restCounts,
            lastRestRound,
            avgRestsPerPlayer,
            opponentHistory
          );
          roundSitters = [...specifiedSitters, ...extra];
        } else {
          roundSitters = specifiedSitters;
        }
      } else {
        roundSitters = this.selectSittersForRound(
          playerIds,
          sittersPerRound,
          roundNum,
          restCounts,
          lastRestRound,
          avgRestsPerPlayer,
          opponentHistory
        );
      }

      restMatrix.push(roundSitters);
      const restingPlayers = new Set(roundSitters);
      const playingPlayers = playerIds.filter(id => !restingPlayers.has(id));

      const games = this.buildRoundGames(
        roundNum + 1,
        playingPlayers,
        partnerHistory,
        opponentHistory,
        recentOpponentHistory,
        courtHistory,
        seed
      );

      rounds.push(games);

      // Update history
      for (const game of games) {
        const [a1, a2] = game.team1;
        const [b1, b2] = game.team2;

        if (!partnerHistory[a1] || !partnerHistory[a2] || !partnerHistory[b1] || !partnerHistory[b2]) {
          console.warn('Invalid player IDs in game:', game);
          continue; // Skip invalid games
        }

        // Partners - track counts
        partnerHistory[a1][a2] = (partnerHistory[a1][a2] || 0) + 1;
        partnerHistory[a2][a1] = (partnerHistory[a2][a1] || 0) + 1;
        partnerHistory[b1][b2] = (partnerHistory[b1][b2] || 0) + 1;
        partnerHistory[b2][b1] = (partnerHistory[b2][b1] || 0) + 1;

        // Opponents (overall count)
        for (const p1 of [a1, a2]) {
          for (const p2 of [b1, b2]) {
            if (!opponentHistory[p1]) {
              opponentHistory[p1] = {};
            }
            if (!opponentHistory[p2]) {
              opponentHistory[p2] = {};
            }
            opponentHistory[p1][p2] = (opponentHistory[p1][p2] || 0) + 1;
            opponentHistory[p2][p1] = (opponentHistory[p2][p1] || 0) + 1;
          }
        }

        // Recent opponents (for consecutive round tracking)
        for (const p1 of [a1, a2]) {
          const opponents = [b1, b2];
          if (!recentOpponentHistory[p1]) {
            recentOpponentHistory[p1] = [];
          }
          recentOpponentHistory[p1].push(opponents);
          // Keep only last 2 rounds
          if (recentOpponentHistory[p1].length > 2) {
            recentOpponentHistory[p1].shift();
          }
        }
        for (const p2 of [b1, b2]) {
          const opponents = [a1, a2];
          if (!recentOpponentHistory[p2]) {
            recentOpponentHistory[p2] = [];
          }
          recentOpponentHistory[p2].push(opponents);
          // Keep only last 2 rounds
          if (recentOpponentHistory[p2].length > 2) {
            recentOpponentHistory[p2].shift();
          }
        }

        // Courts
        for (const pid of [a1, a2, b1, b2]) {
          if (!courtHistory[pid]) {
            courtHistory[pid] = [];
          }
          courtHistory[pid].push(game.court);
        }
      }
    }

    return {
      rounds,
      restingPlayers: restMatrix,
      eventLabel,
      options: this.opts,
      generatedAt: new Date()
    };
  }

  /**
   * Select sitters for a round using greedy heuristic.
   * Optionally uses opponent history so that players with many repeated opponents
   * are slightly preferred to sit (reducing future repeated encounters).
   *
   * When sittersPerRound === 2, uses pair-level optimization: tries all C(n,2) pairs
   * and adds a large bonus for co-sitting players who have already faced each other 2+
   * times, preventing a 3rd encounter.
   */
  private selectSittersForRound(
    playerIds: string[],
    sittersPerRound: number,
    currentRound: number,
    restCounts: Record<string, number>,
    lastRestRound: Record<string, number>,
    avgRestsPerPlayer: number,
    opponentHistory: Record<string, Record<string, number>> = {}
  ): string[] {
    // Helper: compute individual sit-score for one player (higher = better to sit)
    const computeScore = (pid: string): number => {
      let score = 0;
      if (this.opts.distributeRestEqually) {
        const restDeficit = avgRestsPerPlayer - (restCounts[pid] || 0);
        score += restDeficit * 1000;
      }
      const roundsSinceRest = currentRound - (lastRestRound[pid] || 0);
      score += roundsSinceRest * 10;
      const hotOpponentSum = Object.values(opponentHistory[pid] || {})
        .filter(c => c >= 2)
        .reduce((sum, c) => sum + (c - 1), 0);
      score += hotOpponentSum * 8;
      return score;
    };

    // Pair-optimized selection when sittersPerRound === 2:
    // Try all C(n,2) candidate pairs and add a large bonus for co-sitting
    // players who have already faced each other 2+ times as opponents.
    if (sittersPerRound === 2) {
      let bestPairScore = -Infinity;
      let bestPair: string[] = [];

      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const pid1 = playerIds[i];
          const pid2 = playerIds[j];
          if (pid1 === undefined || pid2 === undefined) {
            continue;
          }
          let pairScore = computeScore(pid1) + computeScore(pid2) + Math.random() * 0.1;

          // Hot-pair bonus: slightly prefer co-sitting players who face each other often.
          // Kept small (1000) so rest equity (1000 per deficit unit) remains the primary driver.
          // Guard: only apply if neither player has significantly more rests than average.
          const oppCount = opponentHistory[pid1]?.[pid2] ?? 0;
          if (oppCount >= 2) {
            const equity1 = avgRestsPerPlayer - (restCounts[pid1] || 0);
            const equity2 = avgRestsPerPlayer - (restCounts[pid2] || 0);
            if (equity1 > -0.5 && equity2 > -0.5) {
              pairScore += 1000 * (oppCount - 1);
            }
          }

          if (pairScore > bestPairScore) {
            bestPairScore = pairScore;
            bestPair = [pid1, pid2];
          }
        }
      }

      if (bestPair.length === 2) {
        for (const pid of bestPair) {
          restCounts[pid] = (restCounts[pid] || 0) + 1;
          lastRestRound[pid] = currentRound;
        }
        return bestPair;
      }
    }

    // General case: score each player individually, pick top N
    const scores: Array<{ id: string; score: number }> = playerIds.map(pid => ({
      id: pid,
      score: computeScore(pid) + Math.random() * 0.1
    }));

    scores.sort((a, b) => b.score - a.score);
    const selected = scores.slice(0, sittersPerRound).map(s => s.id);

    for (const pid of selected) {
      restCounts[pid] = (restCounts[pid] || 0) + 1;
      lastRestRound[pid] = currentRound;
    }

    return selected;
  }

  /**
   * Cached pair-index partitions for n players (computed once per n, reused each round).
   * For n=8 there are 7!! = 105 partitions; each entry is an array of [i,j] index pairs.
   */
  private static readonly indexPartitionCache = new Map<
    number,
    ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  >();

  private static computePairIndexPartitions(n: number): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
    const result: [number, number][][] = [];
    const helper = (avail: number[], cur: [number, number][]): void => {
      if (avail.length === 0) {
        result.push([...cur]);
        return;
      }
      const first = avail[0] || 0;
      for (let i = 1; i < avail.length; i++) {
        const remaining: number[] = [];
        for (let j = 1; j < avail.length; j++) {
          if (j !== i) {
            remaining.push(avail[j] || 0);
          }
        }
        cur.push([first, avail[i] || 0]);
        helper(remaining, cur);
        cur.pop();
      }
    };
    helper(
      Array.from({ length: n }, (_, i) => i),
      []
    );
    return result;
  }

  private static getPairIndexPartitions(n: number): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
    let cached = PickleballMatcher.indexPartitionCache.get(n);
    if (!cached) {
      cached = PickleballMatcher.computePairIndexPartitions(n);
      PickleballMatcher.indexPartitionCache.set(n, cached);
    }
    return cached;
  }

  /**
   * Fast opponent-matchup scorer for the exhaustive search.
   * Mirrors scoreTeamMatchup but avoids this.player() O(n) lookups so the
   * 630 calls per round remain cheap.
   */
  private scoreOpponentPairFast(
    t1a: string,
    t1b: string,
    t2a: string,
    t2b: string,
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>,
    opponentPriority: number
  ): number {
    const c00 = opponentHistory[t1a]?.[t2a] || 0;
    const c01 = opponentHistory[t1a]?.[t2b] || 0;
    const c10 = opponentHistory[t1b]?.[t2a] || 0;
    const c11 = opponentHistory[t1b]?.[t2b] || 0;

    const total = c00 + c01 + c10 + c11;
    const repeats = (c00 > 0 ? 1 : 0) + (c01 > 0 ? 1 : 0) + (c10 > 0 ? 1 : 0) + (c11 > 0 ? 1 : 0);
    const severe = Math.max(0, c00 - 1) + Math.max(0, c01 - 1) + Math.max(0, c10 - 1) + Math.max(0, c11 - 1);
    const maxC = Math.max(c00, c01, c10, c11);

    let score = 0;
    if (repeats === 0) {
      score += 18000 * opponentPriority;
    } else {
      score -= repeats * 2200 * opponentPriority;
      score -= severe * 4200 * opponentPriority;
      score -= maxC * maxC * maxC * 250 * opponentPriority;
    }
    score -= total * 300 * opponentPriority;

    const rh1a = recentOpponentHistory[t1a];
    const rh1b = recentOpponentHistory[t1b];
    const last1a = rh1a?.[rh1a.length - 1];
    const last1b = rh1b?.[rh1b.length - 1];
    const twoAgo1a = rh1a?.[rh1a.length - 2];
    const twoAgo1b = rh1b?.[rh1b.length - 2];

    let lr = 0;
    let ta = 0;
    if (last1a?.includes(t2a)) {
      lr++;
    }
    if (last1a?.includes(t2b)) {
      lr++;
    }
    if (last1b?.includes(t2a)) {
      lr++;
    }
    if (last1b?.includes(t2b)) {
      lr++;
    }
    if (twoAgo1a?.includes(t2a)) {
      ta++;
    }
    if (twoAgo1a?.includes(t2b)) {
      ta++;
    }
    if (twoAgo1b?.includes(t2a)) {
      ta++;
    }
    if (twoAgo1b?.includes(t2b)) {
      ta++;
    }
    score -= lr * 900 * opponentPriority;
    score -= ta * 300 * opponentPriority;

    return score;
  }

  /**
   * Exhaustive partner-pairing for 2-court pools (8 players).
   * Uses static cached index partitions and a fast inline scorer that avoids
   * this.player() O(n) lookups — 315 arrangements in microseconds per round.
   */
  private buildRoundMatchingsExhaustive(
    playingPlayers: string[],
    partnerHistory: Record<string, Record<string, number>>,
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>,
    seed: number
  ): Array<{ team1: [string, string]; team2: [string, string] }> | null {
    const n = playingPlayers.length;
    const indexPartitions = PickleballMatcher.getPairIndexPartitions(n);
    const opPri = this.preferenceMultiplier(this.opts.opponentDiversityPriority);

    let bestScore = -Infinity;
    let bestMatchings: Array<{ team1: [string, string]; team2: [string, string] }> | null = null;

    for (const idxPart of indexPartitions) {
      const part0 = idxPart[0];
      const part1 = idxPart[1];
      const part2 = idxPart[2];
      const part3 = idxPart[3];

      if (!part0 || !part1 || !part2 || !part3) {
        continue;
      }

      const i0 = part0[0],
        i1 = part0[1];
      const i2 = part1[0],
        i3 = part1[1];
      const i4 = part2[0],
        i5 = part2[1];
      const i6 = part3[0],
        i7 = part3[1];

      const p0 = playingPlayers[i0],
        p1 = playingPlayers[i1];
      const p2 = playingPlayers[i2],
        p3 = playingPlayers[i3];
      const p4 = playingPlayers[i4],
        p5 = playingPlayers[i5];
      const p6 = playingPlayers[i6],
        p7 = playingPlayers[i7];

      if (
        p0 === undefined ||
        p1 === undefined ||
        p2 === undefined ||
        p3 === undefined ||
        p4 === undefined ||
        p5 === undefined ||
        p6 === undefined ||
        p7 === undefined
      ) {
        continue;
      }

      // Partner quality: 4 pairs
      let partnerScore = 0;
      for (let pi = 0; pi < 4; pi++) {
        const pa = pi === 0 ? p0 : pi === 1 ? p2 : pi === 2 ? p4 : p6;
        const pb = pi === 0 ? p1 : pi === 1 ? p3 : pi === 2 ? p5 : p7;
        const playCount = partnerHistory[pa]?.[pb] || 0;
        if (playCount === 0) {
          partnerScore += 100000;
          const oppCount = opponentHistory[pa]?.[pb] || 0;
          if (oppCount > 0) {
            partnerScore += Math.min(oppCount * 600, 5000);
          }
        } else {
          partnerScore -= 50000 * 3 ** playCount;
        }
      }

      // 3 matchup options: t0 vs t1 + t2 vs t3 | t0 vs t2 + t1 vs t3 | t0 vs t3 + t1 vs t2
      const s01 = this.scoreOpponentPairFast(p0, p1, p2, p3, opponentHistory, recentOpponentHistory, opPri);
      const s23 = this.scoreOpponentPairFast(p4, p5, p6, p7, opponentHistory, recentOpponentHistory, opPri);
      const s02 = this.scoreOpponentPairFast(p0, p1, p4, p5, opponentHistory, recentOpponentHistory, opPri);
      const s13 = this.scoreOpponentPairFast(p2, p3, p6, p7, opponentHistory, recentOpponentHistory, opPri);
      const s03 = this.scoreOpponentPairFast(p0, p1, p6, p7, opponentHistory, recentOpponentHistory, opPri);
      const s12 = this.scoreOpponentPairFast(p2, p3, p4, p5, opponentHistory, recentOpponentHistory, opPri);

      const sc1 = s01 + s23,
        sc2 = s02 + s13,
        sc3 = s03 + s12;

      let bestOppScore: number;
      let matchIdx: 0 | 1 | 2;
      if (sc1 >= sc2 && sc1 >= sc3) {
        bestOppScore = sc1;
        matchIdx = 0;
      } else if (sc2 >= sc3) {
        bestOppScore = sc2;
        matchIdx = 1;
      } else {
        bestOppScore = sc3;
        matchIdx = 2;
      }

      const rnd = (((seed * 1664525 + i1 * 22695477 + 1013904223) >>> 0) / 4294967295.0) * 50;
      const totalScore = partnerScore + bestOppScore + rnd;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        if (matchIdx === 0) {
          bestMatchings = [
            { team1: [p0, p1], team2: [p2, p3] },
            { team1: [p4, p5], team2: [p6, p7] }
          ];
        } else if (matchIdx === 1) {
          bestMatchings = [
            { team1: [p0, p1], team2: [p4, p5] },
            { team1: [p2, p3], team2: [p6, p7] }
          ];
        } else {
          bestMatchings = [
            { team1: [p0, p1], team2: [p6, p7] },
            { team1: [p2, p3], team2: [p4, p5] }
          ];
        }
      }
    }

    return bestMatchings;
  }

  /**
   * Build games for a single round.
   */
  private buildRoundGames(
    roundNum: number,
    playingPlayers: string[],
    partnerHistory: Record<string, Record<string, number>>,
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>,
    courtHistory: Record<string, number[]>,
    seed: number
  ): Game[] {
    const games: Game[] = [];

    // Validate we have the right number of players
    const expectedPlayers = this.opts.numberOfCourts * 4;
    if (playingPlayers.length !== expectedPlayers) {
      throw new Error(`Round ${roundNum}: Expected ${expectedPlayers} players but got ${playingPlayers.length}`);
    }

    let matchings: Array<{ team1: [string, string]; team2: [string, string] }>;

    // For tight 2-court pools (only 2 sitters per round), exhaustively search all 105 partner
    // pairings × 3 matchup options = 315 total round arrangements. This finds the globally
    // optimal arrangement without the greedy's tunnel-vision bias.
    // Only applies when sittersPerRound ≤ 2 (dense schedule); larger pools use greedy.
    const activeTotalPlayers = this.players.filter(p => p.active !== false).length;
    const sittersPerRound = activeTotalPlayers - this.opts.numberOfCourts * 4;
    if (sittersPerRound <= 2 && playingPlayers.length === 8 && this.opts.numberOfCourts === 2) {
      matchings =
        this.buildRoundMatchingsExhaustive(
          playingPlayers,
          partnerHistory,
          opponentHistory,
          recentOpponentHistory,
          seed
        ) ??
        this.matchPairsGreedy(
          this.createPairsGreedy(playingPlayers, partnerHistory, opponentHistory, seed),
          opponentHistory,
          recentOpponentHistory
        );
    } else {
      const pairs = this.createPairsGreedy(playingPlayers, partnerHistory, opponentHistory, seed);
      matchings = this.matchPairsGreedy(pairs, opponentHistory, recentOpponentHistory);
    }

    // Validate we have the right number of matchings
    const expectedMatchings = this.opts.numberOfCourts;
    if (matchings.length !== expectedMatchings) {
      console.error(
        `Round ${roundNum}: Expected ${expectedMatchings} matchings but got ${matchings.length}. Players: ${playingPlayers.length}`
      );
      // This is a critical error - we can't proceed
      throw new Error(`Failed to create correct number of matchings for round ${roundNum}`);
    }

    // Assign to courts
    const courtAssignments = this.assignCourtsGreedy(matchings, courtHistory, roundNum);

    // Create game objects
    for (let i = 0; i < courtAssignments.length; i++) {
      const assignment = courtAssignments[i];
      if (!assignment) {
        continue;
      }
      const { team1, team2, court } = assignment;

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
   * Uses seeded shuffling for genuine diversity across iterations,
   * with opponent-awareness to help spread opponent encounters.
   */
  private createPairsGreedy(
    players: string[],
    partnerHistory: Record<string, Record<string, number>>,
    opponentHistory: Record<string, Record<string, number>>,
    seed: number
  ): string[][] {
    const pairs: string[][] = [];
    // Shuffle first for genuine diversity across iterations, then stable-sort by partner count
    // Players with equal partner counts keep their shuffled relative order (explored differently each seed)
    const available = this.shuffleWithSeed([...players], seed);

    // FIRST: Handle preferred partners if enabled
    if (this.opts.respectPartnerPreferences) {
      const paired = new Set<string>();

      // Find and pair all preferred partners who are both available
      for (let i = 0; i < available.length; i++) {
        const p1 = available[i];
        if (!p1 || paired.has(p1)) {
          continue;
        }

        const player1 = this.player(p1);
        if (player1.partnerId && available.includes(player1.partnerId) && !paired.has(player1.partnerId)) {
          // Both partners are available - pair them!
          pairs.push([p1, player1.partnerId]);
          paired.add(p1);
          paired.add(player1.partnerId);
        }
      }

      // Remove paired players from available list
      for (const playerId of paired) {
        const index = available.indexOf(playerId);
        if (index > -1) {
          available.splice(index, 1);
        }
      }
    }

    // Sort remaining players by the number of previous partners (ascending).
    // Players with fewer unique partners get paired first; seeded shuffle above
    // provides different orderings among equal-count players across iterations.
    available.sort((a, b) => {
      const aPartners = Object.keys(partnerHistory[a] || {}).length;
      const bPartners = Object.keys(partnerHistory[b] || {}).length;
      return aPartners - bPartners;
    });

    // Use seed-based randomization for controlled exploration
    const randomFactor = ((seed * 9301 + 49297) % 233280) / 233280.0; // Simple PRNG

    while (available.length >= 2) {
      const p1 = available.shift();
      if (!p1) {
        continue; // Should never happen due to length check, but satisfies linter
      }

      // Find best partner for p1 (prefer someone they haven't played with)
      let bestPartner: string | null = null;
      let bestScore = -Infinity;

      for (let i = 0; i < available.length; i++) {
        const p2 = available[i];
        if (!p2) {
          continue; // Skip if somehow undefined
        }
        let score = 0;

        // HIGHEST PRIORITY: Prefer new partners
        const playCount = partnerHistory[p1]?.[p2] || 0;
        if (playCount === 0) {
          score += 100000; // Extremely high weight for new partners
        } else {
          // Exponentially penalize based on how many times they've played
          score -= 50000 * 3 ** playCount; // Much stronger exponential penalty
        }

        // Secondary priority: Among new partners, prefer to pair frequent opponents together.
        // Making them partners this round prevents another opponent encounter.
        if (playCount === 0) {
          const oppCount = opponentHistory[p1]?.[p2] || 0;
          if (oppCount > 0) {
            // Bonus capped at 5000 so it only breaks ties among new-partner candidates
            score += Math.min(oppCount * 600, 5000);
          }
        }

        // Tertiary priority: Balance the number of unique partners each player has
        const p1PartnerCount = Object.keys(partnerHistory[p1] || {}).length;
        const p2PartnerCount = Object.keys(partnerHistory[p2] || {}).length;
        const partnerCountDiff = Math.abs(p1PartnerCount - p2PartnerCount);
        score -= partnerCountDiff * 100; // Prefer pairing players with similar partner counts

        // Consider skill balance if enabled
        if (this.opts.balanceSkillLevels) {
          const skill1 = this.player(p1).skillLevel;
          const skill2 = this.player(p2).skillLevel;
          const avgSkill = (skill1 + skill2) / 2;
          // Prefer pairs with mid-range combined skill
          score += (3.5 - Math.abs(avgSkill - 3.5)) * 10;
        }

        // Add seed-based randomization for exploration (scaled by iteration)
        const randomComponent = (((seed + i * 13 + p2.charCodeAt(0)) * 9301 + 49297) % 233280) / 233280.0;
        score += randomComponent * 100 * randomFactor; // Increased controlled randomness

        if (score > bestScore) {
          bestScore = score;
          bestPartner = p2;
        }
      }

      if (bestPartner) {
        pairs.push([p1, bestPartner]);
        available.splice(available.indexOf(bestPartner), 1);
      } else if (available.length > 0) {
        // Force pairing with first available if no best partner found
        const forcedPartner = available.shift();
        if (forcedPartner) {
          pairs.push([p1, forcedPartner]);
        }
      }
    }

    return pairs;
  }

  /**
   * Match pairs against each other, avoiding recent opponents.
   */
  private matchPairsGreedy(
    pairs: string[][],
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>
  ): Array<{ team1: [string, string]; team2: [string, string] }> {
    const strictMatchings = this.findBestPairingsForRound(pairs, opponentHistory, recentOpponentHistory, true);
    if (strictMatchings) {
      return strictMatchings;
    }

    const relaxedMatchings = this.findBestPairingsForRound(pairs, opponentHistory, recentOpponentHistory, false);
    if (relaxedMatchings) {
      return relaxedMatchings;
    }

    // Fallback: pair sequentially to guarantee progress if scoring unexpectedly fails.
    const fallback: Array<{ team1: [string, string]; team2: [string, string] }> = [];
    const available = [...pairs];
    while (available.length >= 2) {
      const team1 = available.shift();
      const team2 = available.shift();
      if (!team1 || !team2) {
        continue;
      }
      fallback.push({
        team1: [team1[0] || '', team1[1] || ''],
        team2: [team2[0] || '', team2[1] || '']
      });
    }

    return fallback;
  }

  private findBestPairingsForRound(
    teams: string[][],
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>,
    enforceSkillLimit: boolean
  ): Array<{ team1: [string, string]; team2: [string, string] }> | null {
    const memo = new Map<
      string,
      { score: number; matchings: Array<{ team1: [string, string]; team2: [string, string] }> } | null
    >();

    const solve = (
      remainingTeams: string[][]
    ): { score: number; matchings: Array<{ team1: [string, string]; team2: [string, string] }> } | null => {
      if (remainingTeams.length === 0) {
        return { score: 0, matchings: [] };
      }

      const stateKey = this.pairingStateKey(remainingTeams);
      const cached = memo.get(stateKey);
      if (cached !== undefined) {
        return cached;
      }

      const team1 = remainingTeams[0];
      if (!team1) {
        memo.set(stateKey, null);
        return null;
      }

      let best: { score: number; matchings: Array<{ team1: [string, string]; team2: [string, string] }> } | null = null;

      for (let i = 1; i < remainingTeams.length; i++) {
        const team2 = remainingTeams[i];
        if (!team2) {
          continue;
        }

        const matchupScore = this.scoreTeamMatchup(
          team1,
          team2,
          opponentHistory,
          recentOpponentHistory,
          enforceSkillLimit
        );
        if (matchupScore === null) {
          continue;
        }

        const nextRemaining = remainingTeams.slice(1, i).concat(remainingTeams.slice(i + 1));
        const subSolution = solve(nextRemaining);
        if (!subSolution) {
          continue;
        }

        const totalScore = matchupScore + subSolution.score;
        if (!best || totalScore > best.score) {
          best = {
            score: totalScore,
            matchings: [
              {
                team1: [team1[0] || '', team1[1] || ''],
                team2: [team2[0] || '', team2[1] || '']
              },
              ...subSolution.matchings
            ]
          };
        }
      }

      memo.set(stateKey, best);
      return best;
    };

    const bestMatchings = solve(teams);
    return bestMatchings ? bestMatchings.matchings : null;
  }

  private pairingStateKey(teams: string[][]): string {
    return teams
      .map(team => this.pairKey(team[0] || '', team[1] || ''))
      .sort()
      .join(';');
  }

  private scoreTeamMatchup(
    team1: string[],
    team2: string[],
    opponentHistory: Record<string, Record<string, number>>,
    recentOpponentHistory: Record<string, string[][]>,
    enforceSkillLimit: boolean
  ): number | null {
    const opponentPriority = this.preferenceMultiplier(this.opts.opponentDiversityPriority);
    const skill1 = team1.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
    const skill2 = team2.reduce((sum, id) => sum + this.player(id).skillLevel, 0);
    const skillDiff = Math.abs(skill1 - skill2);

    if (enforceSkillLimit && this.opts.balanceSkillLevels && skillDiff > this.opts.maxSkillDifference) {
      return null;
    }

    let opponentCount = 0;
    let repeatedMatchups = 0;
    let severeRepeatedMatchups = 0;
    let maxPairRepeat = 0;
    let lastRoundRepeatCount = 0;
    let twoRoundsAgoRepeatCount = 0;

    for (const p1 of team1) {
      const recentHistory = recentOpponentHistory[p1];
      const lastRoundOpponents = recentHistory?.[recentHistory.length - 1];
      const twoRoundsAgoOpponents = recentHistory?.[recentHistory.length - 2];

      for (const p2 of team2) {
        const count = opponentHistory[p1]?.[p2] || 0;
        opponentCount += count;
        if (count > 0) {
          repeatedMatchups++;
        }
        if (count > 1) {
          severeRepeatedMatchups += count - 1;
        }
        maxPairRepeat = Math.max(maxPairRepeat, count);

        if (lastRoundOpponents?.includes(p2)) {
          lastRoundRepeatCount++;
        }
        if (twoRoundsAgoOpponents?.includes(p2)) {
          twoRoundsAgoRepeatCount++;
        }
      }
    }

    let score = 0;

    if (repeatedMatchups === 0) {
      score += 18000 * opponentPriority;
    } else {
      score -= repeatedMatchups * 2200 * opponentPriority;
      score -= severeRepeatedMatchups * 4200 * opponentPriority;
      score -= maxPairRepeat * maxPairRepeat * maxPairRepeat * 250 * opponentPriority;
    }

    score -= opponentCount * 300 * opponentPriority;
    score -= lastRoundRepeatCount * 900 * opponentPriority;
    score -= twoRoundsAgoRepeatCount * 300 * opponentPriority;

    if (this.opts.balanceSkillLevels) {
      score -= skillDiff * 25;
      if (!enforceSkillLimit && skillDiff > this.opts.maxSkillDifference) {
        score -= (skillDiff - this.opts.maxSkillDifference) * 200;
      }
    }

    return score;
  }

  /**
   * Assign games to courts, penalizing consecutive same-court assignments.
   * Ensures each court is used exactly once per round.
   */
  private assignCourtsGreedy(
    matchings: Array<{ team1: [string, string]; team2: [string, string] }>,
    courtHistory: Record<string, number[]>,
    _roundNum: number
  ): Array<{ team1: [string, string]; team2: [string, string]; court: number }> {
    const courtPriority = this.preferenceMultiplier(this.opts.courtDiversityPriority);
    const assignments: Array<{ team1: [string, string]; team2: [string, string]; court: number }> = [];
    const usedCourts = new Set<number>();

    for (let i = 0; i < matchings.length; i++) {
      const matching = matchings[i];
      if (!matching) {
        console.warn('No matching found for court assignment at index', i);
        continue;
      }
      const { team1, team2 } = matching;
      let bestCourt = 1;
      let bestScore = -Infinity;

      for (let court = 1; court <= this.opts.numberOfCourts; court++) {
        // Skip courts already used in this round
        if (usedCourts.has(court)) {
          continue;
        }

        let score = 0;

        // Check for consecutive same-court penalties
        for (const pid of [...team1, ...team2]) {
          const history = courtHistory[pid];

          if (!history) {
            console.warn(`No court history for player ${pid}`);
            continue;
          }

          // Add heavy penalty if player was on this court in the last round
          if (history.length > 0) {
            const lastCourt = history[history.length - 1];
            if (lastCourt === court) {
              score -= 100 * courtPriority; // Heavy penalty for consecutive rounds on same court
            }
          }

          // Add additional penalty if player was on this court in both of the last 2 rounds
          if (history.length > 1) {
            const lastCourt = history[history.length - 1];
            const secondLastCourt = history[history.length - 2];
            if (lastCourt === court && secondLastCourt === court) {
              score -= 200 * courtPriority; // Extra heavy penalty for 2 consecutive rounds on same court
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
    const opponentPriority = this.preferenceMultiplier(this.opts.opponentDiversityPriority);
    const courtPriority = this.preferenceMultiplier(this.opts.courtDiversityPriority);
    let score = 0;

    // PRIORITY 0: First round sitters must be respected (if specified)
    // This is enforced during construction, so we don't penalize here

    // PRIORITY 1: Even rest distribution (max difference of 1) - if enabled
    if (this.opts.distributeRestEqually) {
      score += this.scoreRestDistribution(schedule) * 10000;
    }

    // PRIORITY 2: Rest spacing (maximize distance between rests)
    score += this.scoreRestSpacing(schedule) * 1000;

    // PRIORITY 3: Minimize partner repeats (HIGHEST priority for gameplay)
    score += this.scorePartnerRepeats(schedule) * 2500;

    // PRIORITY 4: Consecutive opponent penalties
    score += this.scoreConsecutiveOpponents(schedule) * 120 * opponentPriority;

    // PRIORITY 5: Minimize opponent repeats (overall)
    score += this.scoreOpponentRepeats(schedule) * 320 * opponentPriority;

    // PRIORITY 5b: Extra penalty for opponent encounters above 2 — sum of (count-2) per pair.
    // Sum-based scoring penalises concentration: a pair at count=4 costs twice as much as
    // a pair at count=3, which naturally keeps the maximum encounter depth low.
    // Weight 30000: a 2-unit avoidable difference contributes 60,000, reliably dominating
    // rest-spacing noise (~0-20k) and a count-2 partner repeat (~25,000) so the right seed
    // is selected consistently across runs.
    score += this.scoreOpponentsAboveTwo(schedule) * 30000 * opponentPriority;

    // PRIORITY 6: Consecutive court penalties
    score += this.scoreConsecutiveCourts(schedule) * 30 * courtPriority;

    // PRIORITY 7: Skill level balance (if enabled)
    if (this.opts.balanceSkillLevels) {
      score += this.scoreSkillBalance(schedule) * 5;
      // Add penalty for games exceeding maxSkillDifference
      score += this.scoreMaxSkillDifferenceViolations(schedule) * 100;
    }

    // PRIORITY 8: Couples play together (if enabled)
    // Weight 1000: 100,000 per unplayed couple — prevents local search from breaking preferred pairs
    if (this.opts.respectPartnerPreferences) {
      score += this.scoreCouplesPreference(schedule) * 1000;
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
        if (!restCounts[pid]) {
          restCounts[pid] = 0;
        }
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
          gaps.push((restRounds[i] ?? 0) - (restRounds[i - 1] ?? 0));
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((sum, gap) => sum + (gap - avgGap) ** 2, 0) / gaps.length;
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
        // Much stronger exponential penalty for repeats
        penalty += 10 ** (count - 1);
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
      // Penalize every repeat; escalate rapidly as repeat count grows.
      if (count > 1) {
        penalty += 6 ** (count - 1);
      }
    }

    return penalty;
  }

  /**
   * Count total opponent encounters above 2 across all pairs.
   * This is the raw component of the "avoidable overflow above 2" test metric.
   */
  private scoreOpponentsAboveTwo(schedule: GameSchedule): number {
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

    let total = 0;
    for (const count of Object.values(opponentCounts)) {
      if (count > 2) {
        total += count - 2;
      }
    }
    return total;
  }

  private scoreConsecutiveOpponents(schedule: GameSchedule): number {
    const players = this.players.filter(p => p.active !== false);
    let penalty = 0;

    for (const player of players) {
      const opponentsByRound: string[][] = [];

      // Build opponent history for each round
      for (const round of schedule.rounds) {
        const opponents: string[] = [];
        for (const game of round) {
          if (game.team1.includes(player.id)) {
            opponents.push(...game.team2);
          } else if (game.team2.includes(player.id)) {
            opponents.push(...game.team1);
          }
        }
        opponentsByRound.push(opponents);
      }

      // Check for consecutive round opponents
      for (let i = 1; i < opponentsByRound.length; i++) {
        const currentOpponents = opponentsByRound[i];
        const lastRoundOpponents = opponentsByRound[i - 1];

        // Large penalty if any opponent from last round appears again
        for (const opp of currentOpponents || []) {
          if (lastRoundOpponents?.includes(opp)) {
            penalty += 100; // Heavy penalty for consecutive round
          }
        }

        // Check 2 rounds back (smaller penalty)
        if (i >= 2) {
          const twoRoundsAgoOpponents = opponentsByRound[i - 2];
          for (const opp of currentOpponents || []) {
            if (twoRoundsAgoOpponents?.includes(opp)) {
              penalty += 30; // Smaller penalty for 2 rounds ago
            }
          }
        }
      }
    }

    return penalty;
  }

  private scoreConsecutiveCourts(schedule: GameSchedule): number {
    const players = this.players.filter(p => p.active !== false);
    let penalty = 0;

    for (const player of players) {
      const courtHistory: number[] = [];

      // Build court history for each round
      for (const round of schedule.rounds) {
        for (const game of round) {
          if (game.team1.includes(player.id) || game.team2.includes(player.id)) {
            courtHistory.push(game.court);
            break;
          }
        }
      }

      // Check for consecutive same-court assignments
      for (let i = 1; i < courtHistory.length; i++) {
        if (courtHistory[i] === courtHistory[i - 1]) {
          penalty += 50; // Penalty for playing on same court in consecutive rounds

          // Extra penalty if same court for 2 consecutive rounds
          if (i >= 2 && courtHistory[i] === courtHistory[i - 2]) {
            penalty += 100; // Additional penalty for 3 consecutive rounds on same court
          }
        }
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
          violations += 2 ** excess;
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

  /**
   * Count how many rounds two specific players faced each other as opponents.
   */
  private countPairOpponentEncounters(schedule: GameSchedule, id1: string, id2: string): number {
    let count = 0;
    for (const round of schedule.rounds) {
      for (const game of round) {
        if (
          (game.team1.includes(id1) && game.team2.includes(id2)) ||
          (game.team2.includes(id1) && game.team1.includes(id2))
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Targeted repair: find opponent pairs that face each other 3+ times and
   * try intra-round swaps to reduce their encounter count without worsening partner repeats.
   */
  private repairHotOpponentPairs(schedule: GameSchedule): GameSchedule {
    let current = schedule;

    for (let pass = 0; pass < 15; pass++) {
      // Compute current opponent counts
      const opponentCounts = new Map<string, number>();
      for (const round of current.rounds) {
        for (const game of round) {
          for (const p1 of game.team1) {
            for (const p2 of game.team2) {
              const key = this.pairKey(p1, p2);
              opponentCounts.set(key, (opponentCounts.get(key) || 0) + 1);
            }
          }
        }
      }

      // Find hot pairs (encounter count ≥ 3), sorted by hottest first
      const hotPairs = Array.from(opponentCounts.entries())
        .filter(([, c]) => c >= 3)
        .sort((a, b) => b[1] - a[1]);

      if (hotPairs.length === 0) {
        break;
      }

      let improved = false;

      for (const [pairKey, hotCount] of hotPairs) {
        const parts = pairKey.split('|');
        const id1 = parts[0];
        const id2 = parts[1];
        if (!id1 || !id2) {
          continue;
        }

        // Find rounds where this pair faced each other as opponents
        for (let r = 0; r < current.rounds.length; r++) {
          const round = current.rounds[r];
          if (!round) {
            continue;
          }
          const facingInRound = round.some(
            g => (g.team1.includes(id1) && g.team2.includes(id2)) || (g.team2.includes(id1) && g.team1.includes(id2))
          );
          if (!facingInRound) {
            continue;
          }

          // Try all cross-game swaps in this round
          type Pos = { gi: number; ti: 0 | 1; pi: 0 | 1 };
          const positions: Pos[] = [];
          for (let gi = 0; gi < round.length; gi++) {
            positions.push({ gi, ti: 0, pi: 0 }, { gi, ti: 0, pi: 1 }, { gi, ti: 1, pi: 0 }, { gi, ti: 1, pi: 1 });
          }

          for (let i = 0; i < positions.length && !improved; i++) {
            for (let j = i + 1; j < positions.length && !improved; j++) {
              const a = positions[i];
              const b = positions[j];
              if (!a || !b || a.gi === b.gi) {
                continue;
              }

              const candidate = this.applySwap(current, r, a, b);
              const newCount = this.countPairOpponentEncounters(candidate, id1, id2);

              if (newCount < hotCount) {
                const currPartner = this.scorePartnerRepeats(current);
                const candPartner = this.scorePartnerRepeats(candidate);

                // Reject if any partnership count would exceed 2 (count>2 penalty is 100+)
                // Allow creating count-2 partnerships (penalty of 10 each) — these are
                // within the test tolerances for small player pools with many rounds.
                if (candPartner > currPartner + 15) {
                  continue; // 15 allows at most one new count-2 pair (penalty 10)
                }

                // If partner preferences enabled, also protect couple pairings
                if (this.opts.respectPartnerPreferences) {
                  const currCouples = this.scoreCouplesPreference(current);
                  const candCouples = this.scoreCouplesPreference(candidate);
                  if (candCouples > currCouples) {
                    continue;
                  }
                }

                current = candidate;
                improved = true;
              }
            }
          }

          // If intra-round swaps didn't help, try inter-round sitter swaps:
          // move one of the hot pair players to sit in this round (swapping with a sitter),
          // while the displaced sitter compensates by taking the hot player's slot in another round.
          if (!improved) {
            const currOppScore = this.scoreOpponentRepeats(current);
            const sittersInR = current.restingPlayers[r] || [];
            for (const sitterIdInR of sittersInR) {
              if (improved) {
                break;
              }
              // Try sitting id1 in round r (id1 was playing, swaps role with sitterIdInR)
              for (let r2 = 0; r2 < current.rounds.length && !improved; r2++) {
                if (r2 === r) {
                  continue;
                }
                const sittersR2 = current.restingPlayers[r2] || [];
                // id1 must be a sitter in r2, sitterIdInR must be a player in r2
                if (!sittersR2.includes(id1)) {
                  continue;
                }
                if (sittersR2.includes(sitterIdInR)) {
                  continue;
                }
                // Rest-spacing guard: moving id1 from r2 to r must not create gap < 2.
                // Also, moving sitterIdInR from r to r2 must not create gap < 2 for them.
                const id1ViolatesSpacing = current.restingPlayers.some(
                  (sitters, ri) => ri !== r2 && sitters.includes(id1) && Math.abs(ri - r) < 2
                );
                if (id1ViolatesSpacing) {
                  continue;
                }
                const sitterViolatesSpacing = current.restingPlayers.some(
                  (sitters, ri) => ri !== r && sitters.includes(sitterIdInR) && Math.abs(ri - r2) < 2
                );
                if (sitterViolatesSpacing) {
                  continue;
                }
                const candidate = this.applyInterRoundSitterSwap(current, id1, sitterIdInR, r, r2);
                const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
                if (newCount < hotCount) {
                  const currPartner = this.scorePartnerRepeats(current);
                  const candPartner = this.scorePartnerRepeats(candidate);
                  // Inter-round swaps affect partnerships in TWO rounds, so allow up to two new
                  // count-2 partnerships (penalty 10 each → threshold 25 covers both).
                  if (candPartner > currPartner + 25) {
                    continue;
                  }
                  // Reject if total opponent score doesn't improve — prevents creating new hot pairs
                  // and avoids "neutral" swap chains that can eventually produce count=4 pairs.
                  if (this.scoreOpponentRepeats(candidate) >= currOppScore) {
                    continue;
                  }
                  if (this.opts.respectPartnerPreferences) {
                    if (this.scoreCouplesPreference(candidate) > this.scoreCouplesPreference(current)) {
                      continue;
                    }
                  }
                  current = candidate;
                  improved = true;
                }
              }
              if (improved) {
                break;
              }
              // Try sitting id2 in round r instead
              for (let r2 = 0; r2 < current.rounds.length && !improved; r2++) {
                if (r2 === r) {
                  continue;
                }
                const sittersR2 = current.restingPlayers[r2] || [];
                if (!sittersR2.includes(id2)) {
                  continue;
                }
                if (sittersR2.includes(sitterIdInR)) {
                  continue;
                }
                // Rest-spacing guard: same checks as for id1 above.
                const id2ViolatesSpacing = current.restingPlayers.some(
                  (sitters, ri) => ri !== r2 && sitters.includes(id2) && Math.abs(ri - r) < 2
                );
                if (id2ViolatesSpacing) {
                  continue;
                }
                const sitterViolatesSpacing2 = current.restingPlayers.some(
                  (sitters, ri) => ri !== r && sitters.includes(sitterIdInR) && Math.abs(ri - r2) < 2
                );
                if (sitterViolatesSpacing2) {
                  continue;
                }
                const candidate = this.applyInterRoundSitterSwap(current, id2, sitterIdInR, r, r2);
                const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
                if (newCount < hotCount) {
                  const currPartner = this.scorePartnerRepeats(current);
                  const candPartner = this.scorePartnerRepeats(candidate);
                  // Inter-round swaps affect partnerships in TWO rounds, so allow up to two new
                  // count-2 partnerships (penalty 10 each → threshold 25 covers both).
                  if (candPartner > currPartner + 25) {
                    continue;
                  }
                  // Reject if total opponent score doesn't improve — prevents creating new hot pairs
                  // and avoids "neutral" swap chains that can eventually produce count=4 pairs.
                  if (this.scoreOpponentRepeats(candidate) >= currOppScore) {
                    continue;
                  }
                  if (this.opts.respectPartnerPreferences) {
                    if (this.scoreCouplesPreference(candidate) > this.scoreCouplesPreference(current)) {
                      continue;
                    }
                  }
                  current = candidate;
                  improved = true;
                }
              }
            }
          }

          // Last resort: full exhaustive re-solve of this round.
          // Enumerate all 315 partner-pairing × matchup arrangements for the 8 playing players,
          // filter out those where id1 and id2 face each other, and pick the arrangement that
          // minimises total opponent overflow (using history from all OTHER rounds).
          if (!improved) {
            const resolveCand = this.tryRepairRoundExhaustive(current, r, id1, id2, hotCount);
            if (resolveCand) {
              current = resolveCand;
              improved = true;
            }
          }

          if (improved) {
            break;
          }
        }
        if (improved) {
          break;
        }
      }

      if (!improved) {
        break;
      }
    }

    return current;
  }

  /**
   * Re-solve an entire round to break a hot opponent pair.
   *
   * Enumerates all 315 partner-pair × matchup arrangements for the 8 playing players in
   * round `roundIdx`, considering only those where `id1` and `id2` are NOT opponents.
   * Uses opponent/partner history from all OTHER rounds as the scoring basis so the
   * chosen arrangement minimises new overflow for the whole schedule.
   *
   * Returns an improved schedule, or null if no valid arrangement exists or if the
   * total opponent score would not strictly improve.
   */
  private tryRepairRoundExhaustive(
    current: GameSchedule,
    roundIdx: number,
    id1: string,
    id2: string,
    hotCount: number
  ): GameSchedule | null {
    const round = current.rounds[roundIdx];
    if (!round || round.length !== 2) {
      return null; // Only handle 2-court rounds
    }

    const playingInRound: string[] = round.flatMap(g => [...g.team1, ...g.team2]);
    if (playingInRound.length !== 8) {
      return null;
    }

    // Build opponent and partner histories from all OTHER rounds.
    const oppHistory: Record<string, Record<string, number>> = {};
    const partnerHistory: Record<string, Record<string, number>> = {};

    for (let r = 0; r < current.rounds.length; r++) {
      if (r === roundIdx) {
        continue;
      }
      const roundAtR = current.rounds[r];
      if (!roundAtR) {
        continue;
      }
      for (const game of roundAtR) {
        // Partner history
        const addPartner = (a: string, b: string): void => {
          if (!partnerHistory[a]) {
            partnerHistory[a] = {};
          }
          partnerHistory[a][b] = (partnerHistory[a][b] || 0) + 1;
          if (!partnerHistory[b]) {
            partnerHistory[b] = {};
          }
          partnerHistory[b][a] = (partnerHistory[b][a] || 0) + 1;
        };
        addPartner(game.team1[0], game.team1[1]);
        addPartner(game.team2[0], game.team2[1]);

        // Opponent history (bidirectional)
        for (const p1 of game.team1) {
          for (const p2 of game.team2) {
            if (!oppHistory[p1]) {
              oppHistory[p1] = {};
            }
            oppHistory[p1][p2] = (oppHistory[p1][p2] || 0) + 1;
            if (!oppHistory[p2]) {
              oppHistory[p2] = {};
            }
            oppHistory[p2][p1] = (oppHistory[p2][p1] || 0) + 1;
          }
        }
      }
    }

    const indexPartitions = PickleballMatcher.getPairIndexPartitions(8);
    const opPri = this.preferenceMultiplier(this.opts.opponentDiversityPriority);
    const emptyRecent: Record<string, string[][]> = {};

    let bestScore = -Infinity;
    let bestMatchings: { team1: [string, string]; team2: [string, string] }[] | null = null;

    for (const idxPart of indexPartitions) {
      const part0 = idxPart[0];
      const part1 = idxPart[1];
      const part2 = idxPart[2];
      const part3 = idxPart[3];

      if (!part0 || !part1 || !part2 || !part3) {
        continue;
      }

      const i0 = part0[0],
        i1 = part0[1];
      const i2 = part1[0],
        i3 = part1[1];
      const i4 = part2[0],
        i5 = part2[1];
      const i6 = part3[0],
        i7 = part3[1];

      const p0 = playingInRound[i0],
        p1 = playingInRound[i1];
      const p2 = playingInRound[i2],
        p3 = playingInRound[i3];
      const p4 = playingInRound[i4],
        p5 = playingInRound[i5];
      const p6 = playingInRound[i6],
        p7 = playingInRound[i7];

      if (
        p0 === undefined ||
        p1 === undefined ||
        p2 === undefined ||
        p3 === undefined ||
        p4 === undefined ||
        p5 === undefined ||
        p6 === undefined ||
        p7 === undefined
      ) {
        continue;
      }

      // Partner score: 4 pairs
      let partnerScore = 0;
      for (let pi = 0; pi < 4; pi++) {
        const pa = pi === 0 ? p0 : pi === 1 ? p2 : pi === 2 ? p4 : p6;
        const pb = pi === 0 ? p1 : pi === 1 ? p3 : pi === 2 ? p5 : p7;
        const pc = partnerHistory[pa]?.[pb] || 0;
        partnerScore += pc === 0 ? 100000 : -50000 * 3 ** pc;
      }

      // Pre-compute which team-pairs contain id1 / id2 (avoids repeated comparisons).
      const t0h1 = p0 === id1 || p1 === id1; // team [p0,p1] contains id1
      const t0h2 = p0 === id2 || p1 === id2;
      const t1h1 = p2 === id1 || p3 === id1; // team [p2,p3]
      const t1h2 = p2 === id2 || p3 === id2;
      const t2h1 = p4 === id1 || p5 === id1; // team [p4,p5]
      const t2h2 = p4 === id2 || p5 === id2;
      const t3h1 = p6 === id1 || p7 === id1; // team [p6,p7]
      const t3h2 = p6 === id2 || p7 === id2;

      // Matchup option 1: [p0,p1] vs [p2,p3] and [p4,p5] vs [p6,p7]
      // Hot pair are opponents if one is in team A and the other is in team B of the same game.
      const hot1a = (t0h1 && t1h2) || (t0h2 && t1h1); // game1
      const hot1b = (t2h1 && t3h2) || (t2h2 && t3h1); // game2
      if (!hot1a && !hot1b) {
        const s =
          this.scoreOpponentPairFast(p0, p1, p2, p3, oppHistory, emptyRecent, opPri) +
          this.scoreOpponentPairFast(p4, p5, p6, p7, oppHistory, emptyRecent, opPri);
        // Opponent score drives selection; partner score is a minor tiebreaker.
        // The partner constraint is enforced at the end of the function.
        const total = s + partnerScore * 0.001;
        if (total > bestScore) {
          bestScore = total;
          bestMatchings = [
            { team1: [p0, p1], team2: [p2, p3] },
            { team1: [p4, p5], team2: [p6, p7] }
          ];
        }
      }

      // Matchup option 2: [p0,p1] vs [p4,p5] and [p2,p3] vs [p6,p7]
      const hot2a = (t0h1 && t2h2) || (t0h2 && t2h1);
      const hot2b = (t1h1 && t3h2) || (t1h2 && t3h1);
      if (!hot2a && !hot2b) {
        const s =
          this.scoreOpponentPairFast(p0, p1, p4, p5, oppHistory, emptyRecent, opPri) +
          this.scoreOpponentPairFast(p2, p3, p6, p7, oppHistory, emptyRecent, opPri);
        const total = s + partnerScore * 0.001;
        if (total > bestScore) {
          bestScore = total;
          bestMatchings = [
            { team1: [p0, p1], team2: [p4, p5] },
            { team1: [p2, p3], team2: [p6, p7] }
          ];
        }
      }

      // Matchup option 3: [p0,p1] vs [p6,p7] and [p2,p3] vs [p4,p5]
      const hot3a = (t0h1 && t3h2) || (t0h2 && t3h1);
      const hot3b = (t1h1 && t2h2) || (t1h2 && t2h1);
      if (!hot3a && !hot3b) {
        const s =
          this.scoreOpponentPairFast(p0, p1, p6, p7, oppHistory, emptyRecent, opPri) +
          this.scoreOpponentPairFast(p2, p3, p4, p5, oppHistory, emptyRecent, opPri);
        const total = s + partnerScore * 0.001;
        if (total > bestScore) {
          bestScore = total;
          bestMatchings = [
            { team1: [p0, p1], team2: [p6, p7] },
            { team1: [p2, p3], team2: [p4, p5] }
          ];
        }
      }
    }

    if (!bestMatchings) {
      return null;
    }

    // Build the candidate schedule.
    const newRound: Game[] = round.map((g, gi) => {
      const m = bestMatchings[gi];
      if (!m) {
        return g;
      }
      const s1 = this.player(m.team1[0]).skillLevel + this.player(m.team1[1]).skillLevel;
      const s2 = this.player(m.team2[0]).skillLevel + this.player(m.team2[1]).skillLevel;
      return {
        ...g,
        team1: m.team1,
        team2: m.team2,
        team1SkillLevel: s1,
        team2SkillLevel: s2,
        skillDifference: Math.abs(s1 - s2)
      };
    });
    const newRounds = [...current.rounds];
    newRounds[roundIdx] = newRound;
    const candidate: GameSchedule = { ...current, rounds: newRounds };

    // The re-solve must actually reduce the hot pair's encounter count.
    const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
    if (newCount >= hotCount) {
      return null;
    }

    // Require a strict improvement in total opponent overflow — prevents neutral swaps that cycle.
    if (this.scoreOpponentRepeats(candidate) >= this.scoreOpponentRepeats(current)) {
      return null;
    }

    // Protect partner diversity.
    const currPartner = this.scorePartnerRepeats(current);
    const candPartner = this.scorePartnerRepeats(candidate);
    if (candPartner > currPartner + 15) {
      return null;
    }

    if (this.opts.respectPartnerPreferences) {
      if (this.scoreCouplesPreference(candidate) > this.scoreCouplesPreference(current)) {
        return null;
      }
    }

    return candidate;
  }

  /**
   * Seeded Fisher-Yates shuffle. Returns a new shuffled array without mutating the original.
   */
  private shuffleWithSeed<T>(arr: T[], seed: number): T[] {
    const result = [...arr];
    let s = (Math.abs(seed * 9301 + 49297) % 233280) + 1;
    for (let i = result.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      const tmp = result[i];
      result[i] = result[j] as T;
      result[j] = tmp as T;
    }
    return result;
  }

  /**
   * Post-construction local search: try swapping players between games within each round.
   * Accepts any swap that improves the total score. Runs multiple passes until no improvement.
   */
  private improveWithLocalSearch(schedule: GameSchedule): GameSchedule {
    let current = schedule;
    let currentScore = this.evaluateScore(current);

    for (let pass = 0; pass < 5; pass++) {
      let improved = false;

      for (let roundIdx = 0; roundIdx < current.rounds.length; roundIdx++) {
        const round = current.rounds[roundIdx];
        if (!round || round.length < 2) {
          continue;
        }

        // Enumerate all player positions in this round
        type Pos = { gi: number; ti: 0 | 1; pi: 0 | 1 };
        const positions: Pos[] = [];
        for (let gi = 0; gi < round.length; gi++) {
          positions.push({ gi, ti: 0, pi: 0 }, { gi, ti: 0, pi: 1 }, { gi, ti: 1, pi: 0 }, { gi, ti: 1, pi: 1 });
        }

        // Try all pairwise swaps between different games
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const a = positions[i];
            const b = positions[j];
            if (!a || !b || a.gi === b.gi) {
              continue; // Only swap between different games
            }

            const candidate = this.applySwap(current, roundIdx, a, b);
            const score = this.evaluateScore(candidate);

            if (score < currentScore) {
              current = candidate;
              currentScore = score;
              improved = true;
            }
          }
        }
      }

      if (!improved) {
        break;
      }
    }

    return current;
  }

  /**
   * Swap two players (at positions a and b in different games within a round) and return the new schedule.
   */
  private applySwap(
    schedule: GameSchedule,
    roundIdx: number,
    a: { gi: number; ti: 0 | 1; pi: 0 | 1 },
    b: { gi: number; ti: 0 | 1; pi: 0 | 1 }
  ): GameSchedule {
    // Copy only the affected round; all other rounds are shared
    const roundToSwap = schedule.rounds[roundIdx];
    if (!roundToSwap) {
      return schedule;
    }
    const newRound = roundToSwap.map(g => ({
      ...g,
      team1: [g.team1[0], g.team1[1]] as [string, string],
      team2: [g.team2[0], g.team2[1]] as [string, string]
    }));

    const ga = newRound[a.gi];
    const gb = newRound[b.gi];
    if (!ga || !gb) {
      return schedule;
    }

    const teamA = a.ti === 0 ? ga.team1 : ga.team2;
    const teamB = b.ti === 0 ? gb.team1 : gb.team2;

    // Perform the swap
    const tmp = teamA[a.pi];
    teamA[a.pi] = teamB[b.pi];
    teamB[b.pi] = tmp;

    // Recompute skill levels for the two affected games
    for (const g of [ga, gb]) {
      const s1 = this.player(g.team1[0]).skillLevel + this.player(g.team1[1]).skillLevel;
      const s2 = this.player(g.team2[0]).skillLevel + this.player(g.team2[1]).skillLevel;
      g.team1SkillLevel = s1;
      g.team2SkillLevel = s2;
      g.skillDifference = Math.abs(s1 - s2);
    }

    const newRounds = [...schedule.rounds];
    newRounds[roundIdx] = newRound;
    return { ...schedule, rounds: newRounds };
  }

  /**
   * Apply an inter-round sitter swap to fix hot opponent pairs.
   *
   * playerToSit is currently a PLAYER in roundR (and faces their hot opponent there).
   * sitterToPlay is currently a SITTER in roundR.
   * In roundR2, the situation is reversed: playerToSit is a SITTER and sitterToPlay is a PLAYER.
   *
   * After the swap:
   * - roundR: sitterToPlay takes playerToSit's game slot; playerToSit becomes a sitter.
   * - roundR2: playerToSit takes sitterToPlay's game slot; sitterToPlay becomes a sitter.
   *
   * This preserves total play count for both players and maintains exactly sittersPerRound
   * sitters in each round.
   */
  private applyInterRoundSitterSwap(
    schedule: GameSchedule,
    playerToSit: string,
    sitterToPlay: string,
    roundR: number,
    roundR2: number
  ): GameSchedule {
    const newRounds = [...schedule.rounds];
    const newRestingPlayers = [...schedule.restingPlayers];

    // Round R: replace playerToSit with sitterToPlay in the games
    {
      const roundAtR = newRounds[roundR];
      if (!roundAtR) {
        return schedule;
      }
      const roundCopy = roundAtR.map(g => ({
        ...g,
        team1: [g.team1[0], g.team1[1]] as [string, string],
        team2: [g.team2[0], g.team2[1]] as [string, string]
      }));
      for (const g of roundCopy) {
        const t1idx = g.team1.indexOf(playerToSit);
        const t2idx = g.team2.indexOf(playerToSit);
        if (t1idx >= 0) {
          g.team1[t1idx] = sitterToPlay;
        } else if (t2idx >= 0) {
          g.team2[t2idx] = sitterToPlay;
        }
        const s1 = this.player(g.team1[0]).skillLevel + this.player(g.team1[1]).skillLevel;
        const s2 = this.player(g.team2[0]).skillLevel + this.player(g.team2[1]).skillLevel;
        g.team1SkillLevel = s1;
        g.team2SkillLevel = s2;
        g.skillDifference = Math.abs(s1 - s2);
      }
      newRounds[roundR] = roundCopy;
      const sittersR = [...(newRestingPlayers[roundR] || [])];
      const si = sittersR.indexOf(sitterToPlay);
      if (si >= 0) {
        sittersR.splice(si, 1);
      }
      sittersR.push(playerToSit);
      newRestingPlayers[roundR] = sittersR;
    }

    // Round R2: replace sitterToPlay with playerToSit in the games
    {
      const roundAtR2 = newRounds[roundR2];
      if (!roundAtR2) {
        return schedule;
      }
      const roundCopy = roundAtR2.map(g => ({
        ...g,
        team1: [g.team1[0], g.team1[1]] as [string, string],
        team2: [g.team2[0], g.team2[1]] as [string, string]
      }));
      for (const g of roundCopy) {
        const t1idx = g.team1.indexOf(sitterToPlay);
        const t2idx = g.team2.indexOf(sitterToPlay);
        if (t1idx >= 0) {
          g.team1[t1idx] = playerToSit;
        } else if (t2idx >= 0) {
          g.team2[t2idx] = playerToSit;
        }
        const s1 = this.player(g.team1[0]).skillLevel + this.player(g.team1[1]).skillLevel;
        const s2 = this.player(g.team2[0]).skillLevel + this.player(g.team2[1]).skillLevel;
        g.team1SkillLevel = s1;
        g.team2SkillLevel = s2;
        g.skillDifference = Math.abs(s1 - s2);
      }
      newRounds[roundR2] = roundCopy;
      const sittersR2 = [...(newRestingPlayers[roundR2] || [])];
      const si2 = sittersR2.indexOf(playerToSit);
      if (si2 >= 0) {
        sittersR2.splice(si2, 1);
      }
      sittersR2.push(sitterToPlay);
      newRestingPlayers[roundR2] = sittersR2;
    }

    return { ...schedule, rounds: newRounds, restingPlayers: newRestingPlayers };
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
