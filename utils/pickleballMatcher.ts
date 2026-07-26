const RELAXED_PREFERENCE_MULTIPLIER = 0.7;
const STRICT_PREFERENCE_MULTIPLIER = 1.5;
const PLAYERS_PER_GAME = 4;
const PAIR_SIZE = 2;
const HIGH_DENSITY_MIN_ROUNDS = 10;
const LARGE_POOL_MIN_PLAYERS = 14;
const BASE_SEARCH_ITERATIONS = 1000;
const HIGH_DENSITY_SEARCH_ITERATIONS = 2500;
const MEDIUM_POOL_SEARCH_ITERATIONS = 1500;
const STANDARD_SCORE_WEIGHT = 100;
const TWO_COURT_PLAYER_CAPACITY = 8;
const NEW_OPPONENT_REWARD = 18000;
const REPEATED_OPPONENT_PENALTY = 2200;
const SEVERE_OPPONENT_REPEAT_PENALTY = 4200;
const MAX_OPPONENT_REPEAT_CUBIC_WEIGHT = 250;
const OPPONENT_REPEAT_COUNT_PENALTY = 300;
const LAST_ROUND_OPPONENT_PENALTY = 900;
const CUBIC_PENALTY_BASE = 3;
const NEW_PARTNER_REWARD = 100000;
const OPPONENT_DIVERSITY_REWARD = 600;
const MAX_OPPONENT_DIVERSITY_REWARD = 5000;
const PARTNER_REPEAT_PENALTY = 50000;
const LCG_SEED_MULTIPLIER = 1664525;
const LCG_INDEX_MULTIPLIER = 22695477;
const LCG_INCREMENT = 1013904223;
const UINT32_MAX_VALUE = 4294967295.0;
const RANDOM_SCORE_RANGE = 50;
const TARGET_AVERAGE_SKILL_LEVEL = 3.5;
const PLAYER_SEED_STRIDE = 13;
const SKILL_DIFFERENCE_WEIGHT = 25;
const EXCESS_SKILL_DIFFERENCE_WEIGHT = 200;
const REST_DISTRIBUTION_WEIGHT = 10000;
const CONSECUTIVE_OPPONENT_WEIGHT = 120;
const OPPONENT_REPEAT_WEIGHT = 320;
const EXCESS_OPPONENT_REPEAT_WEIGHT = 30000;
const CONSECUTIVE_COURT_WEIGHT = 30;
const SKILL_BALANCE_WEIGHT = 5;
const PARTNER_REPEAT_EXPONENTIAL_BASE = 6;
const LOCAL_SEARCH_PASS_LIMIT = 15;
const PREFERRED_PARTNER_REPEAT_PENALTY = -50000;
const PARTNER_SCORE_TIEBREAKER_SCALE = 0.001;
const COURT_USAGE_BALANCE_PENALTY = 1000;
const SAME_COURT_PENALTY = 100;
const SAME_COURT_STREAK_PENALTY = 300;
const COURT_DISTRIBUTION_RANGE_PENALTY = 10000;
const COURT_DISTRIBUTION_VARIANCE_PENALTY = 100;
const MAX_COURT_RANGE_PENALTY = 1000000;
const MAX_EXHAUSTIVE_COURT_ROUNDS = 16;

import type { Game, GameSchedule, MatchingOptions, Player } from '~/types';

const SEEDED_SHUFFLE_MULTIPLIER = 9_301;
const SEEDED_SHUFFLE_INCREMENT = 49_297;
const SEEDED_SHUFFLE_MODULUS = 233_280;
const SEEDED_SHUFFLE_INITIAL_OFFSET = 1;
const ARRAY_INDEX_OFFSET = 1;
const FIRST_ARRAY_INDEX = 0;
const MAX_PASSES = 5;

/**
 * PickleballMatcher - Greedy constructive algorithm with local optimization
 * Builds schedules round-by-round using heuristics, then improves with local search
 */
export class PickleballMatcher {
  public constructor(
    private players: Player[],
    private opts: MatchingOptions
  ) {
    // no-op
  }

  private preferenceMultiplier(level: 'relaxed' | 'balanced' | 'strict' | undefined): number {
    if (level === 'relaxed') {
      return RELAXED_PREFERENCE_MULTIPLIER;
    }
    if (level === 'strict') {
      return STRICT_PREFERENCE_MULTIPLIER;
    }
    return 1.0;
  }

  /**
   * Generate the best schedule using greedy construction + local optimization.
   */
  public async generateSchedule(eventLabel = ''): Promise<GameSchedule> {
    const activePlayers = this.players.filter(p => p.active !== false);
    // Small player pools with many rounds are harder — give them more search budget.
    // 2-court pools use exhaustive per-round construction (315 arrangements evaluated vs ~6
    // greedy), so each iteration is ~20× richer; fewer iterations are needed.
    const sittersPerRound = activePlayers.length - this.opts.numberOfCourts * PLAYERS_PER_GAME;
    const isHighDensity = sittersPerRound <= PAIR_SIZE && this.opts.numberOfRounds >= HIGH_DENSITY_MIN_ROUNDS;
    const usesExhaustive = sittersPerRound <= PAIR_SIZE && this.opts.numberOfCourts === PAIR_SIZE;
    // Large pools (≥14 players) have ample natural variety; 1000 iterations is sufficient.
    // Medium pools (10-13 players, non-exhaustive) need 1500 to find good schedules reliably.
    const isLargePool = activePlayers.length >= LARGE_POOL_MIN_PLAYERS;
    const iterations = usesExhaustive
      ? BASE_SEARCH_ITERATIONS
      : isHighDensity
        ? HIGH_DENSITY_SEARCH_ITERATIONS
        : isLargePool
          ? BASE_SEARCH_ITERATIONS
          : MEDIUM_POOL_SEARCH_ITERATIONS;

    let bestSchedule: GameSchedule | null = null;
    let bestQuality: number[] | null = null;

    // Try multiple random starting points
    for (let i = 0; i < iterations; i += 1) {
      const schedule = this.buildScheduleGreedy(eventLabel, activePlayers, i);
      const quality = this.evaluateQuality(schedule);

      if (!bestSchedule || !bestQuality || this.compareQuality(quality, bestQuality) < 0) {
        bestQuality = quality;
        bestSchedule = schedule;
      }

      // Yield control every 100 iterations to prevent blocking the UI
      if (i % STANDARD_SCORE_WEIGHT === 0) {
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
    bestSchedule = this.improveCourtAssignments(bestSchedule);
    bestSchedule.score = this.evaluateScore(bestSchedule);

    return bestSchedule;
  }

  /**
   * Build a schedule greedily, round by round.
   * Rest assignments are interleaved with game building so that accumulated
   * opponent history can inform smarter sitting decisions.
   */
  private buildScheduleGreedy(eventLabel: string, players: Player[], seed: number): GameSchedule {
    const playerIds = players.map(p => p.id);
    const sittersPerRound = playerIds.length - this.opts.numberOfCourts * PLAYERS_PER_GAME;

    // Build games and rest assignments round-by-round (dynamic rest scheduling)
    const rounds: Game[][] = [];
    const restMatrix: string[][] = [];
    const partnerHistory: Record<string, Record<string, number>> = {};
    const opponentHistory: Record<string, Record<string, number>> = {};
    const recentOpponentHistory: Record<string, string[][]> = {};
    const courtHistory: Record<string, number[]> = {};

    // Initialize history
    for (const pid of playerIds) {
      partnerHistory[pid] = {};
      opponentHistory[pid] = {};
      recentOpponentHistory[pid] = [];
      courtHistory[pid] = [];
    }

    const plannedRests = this.buildBalancedRestPlan(playerIds, Math.max(0, sittersPerRound), seed);

    for (let roundNum = 0; roundNum < this.opts.numberOfRounds; roundNum += 1) {
      const roundSitters = plannedRests[roundNum] || [];

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
      // Update history
      for (const game of games) {
        nextIteration0: {
          const [a1, a2] = game.team1;
          const [b1, b2] = game.team2;
          if (!partnerHistory[a1] || !partnerHistory[a2] || !partnerHistory[b1] || !partnerHistory[b2]) {
            console.warn('Invalid player IDs in game:', game);
            break nextIteration0; // Skip invalid games
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
            if (recentOpponentHistory[p1].length > PAIR_SIZE) {
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
            if (recentOpponentHistory[p2].length > PAIR_SIZE) {
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
    }

    return {
      eventLabel,
      generatedAt: new Date(),
      options: this.opts,
      restingPlayers: restMatrix,
      rounds
    };
  }

  /**
   * Allocate consecutive rest slots around a seeded player ring.
   *
   * This guarantees that rest totals differ by at most one and that every
   * player's rest gaps are either floor(players / sitters) or ceil(players / sitters),
   * which is the widest achievable spacing for a fixed number of sitters per round.
   */
  private buildBalancedRestPlan(playerIds: string[], sittersPerRound: number, seed: number): string[][] {
    if (sittersPerRound <= 0 || playerIds.length === 0) {
      return Array.from({ length: this.opts.numberOfRounds }, () => []);
    }

    const playerSet = new Set(playerIds);
    const specifiedFirstRound = Array.from(new Set(this.opts.firstRoundSitters || []))
      .filter(id => playerSet.has(id))
      .slice(0, sittersPerRound);
    const shuffled = this.shuffleWithSeed(playerIds, seed);
    const firstRound = [
      ...specifiedFirstRound,
      ...shuffled.filter(id => !specifiedFirstRound.includes(id)).slice(0, sittersPerRound - specifiedFirstRound.length)
    ];
    const ring = [...firstRound, ...shuffled.filter(id => !firstRound.includes(id))];

    return Array.from({ length: this.opts.numberOfRounds }, (_, roundIdx) =>
      Array.from({ length: sittersPerRound }, (__, sitterIdx) => {
        const ringIdx = (roundIdx * sittersPerRound + sitterIdx) % ring.length;
        return ring[ringIdx] as string;
      })
    );
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
      for (let i = 1; i < avail.length; i += 1) {
        const remaining: number[] = [];
        for (let j = 1; j < avail.length; j += 1) {
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
      score += NEW_OPPONENT_REWARD * opponentPriority;
    } else {
      score -= repeats * REPEATED_OPPONENT_PENALTY * opponentPriority;
      score -= severe * SEVERE_OPPONENT_REPEAT_PENALTY * opponentPriority;
      score -= maxC * maxC * maxC * MAX_OPPONENT_REPEAT_CUBIC_WEIGHT * opponentPriority;
    }
    score -= total * OPPONENT_REPEAT_COUNT_PENALTY * opponentPriority;

    const rh1a = recentOpponentHistory[t1a];
    const rh1b = recentOpponentHistory[t1b];
    const last1a = rh1a?.[rh1a.length - 1];
    const last1b = rh1b?.[rh1b.length - 1];
    const twoAgo1a = rh1a?.[rh1a.length - PAIR_SIZE];
    const twoAgo1b = rh1b?.[rh1b.length - PAIR_SIZE];

    let lr = 0;
    let ta = 0;
    if (last1a?.includes(t2a)) {
      lr += 1;
    }
    if (last1a?.includes(t2b)) {
      lr += 1;
    }
    if (last1b?.includes(t2a)) {
      lr += 1;
    }
    if (last1b?.includes(t2b)) {
      lr += 1;
    }
    if (twoAgo1a?.includes(t2a)) {
      ta += 1;
    }
    if (twoAgo1a?.includes(t2b)) {
      ta += 1;
    }
    if (twoAgo1b?.includes(t2a)) {
      ta += 1;
    }
    if (twoAgo1b?.includes(t2b)) {
      ta += 1;
    }
    score -= lr * LAST_ROUND_OPPONENT_PENALTY * opponentPriority;
    score -= ta * OPPONENT_REPEAT_COUNT_PENALTY * opponentPriority;

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
      nextIteration2: {
        const part0 = idxPart[0];
        const part1 = idxPart[1];
        const part2 = idxPart[PAIR_SIZE];
        const part3 = idxPart[CUBIC_PENALTY_BASE];
        if (!part0 || !part1 || !part2 || !part3) {
          break nextIteration2;
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
          break nextIteration2;
        }

        // Partner quality: 4 pairs
        let partnerScore = 0;
        for (let pi = 0; pi < PLAYERS_PER_GAME; pi += 1) {
          const pa = pi === 0 ? p0 : pi === 1 ? p2 : pi === PAIR_SIZE ? p4 : p6;
          const pb = pi === 0 ? p1 : pi === 1 ? p3 : pi === PAIR_SIZE ? p5 : p7;
          const playCount = partnerHistory[pa]?.[pb] || 0;
          if (playCount === 0) {
            partnerScore += NEW_PARTNER_REWARD;
            const oppCount = opponentHistory[pa]?.[pb] || 0;
            if (oppCount > 0) {
              partnerScore += Math.min(oppCount * OPPONENT_DIVERSITY_REWARD, MAX_OPPONENT_DIVERSITY_REWARD);
            }
          } else {
            partnerScore -= PARTNER_REPEAT_PENALTY * CUBIC_PENALTY_BASE ** playCount;
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
        let matchIdx: 0 | 1 | typeof PAIR_SIZE;
        if (sc1 >= sc2 && sc1 >= sc3) {
          bestOppScore = sc1;
          matchIdx = 0;
        } else if (sc2 >= sc3) {
          bestOppScore = sc2;
          matchIdx = 1;
        } else {
          bestOppScore = sc3;
          matchIdx = PAIR_SIZE;
        }
        const rnd =
          (Math.trunc(seed * LCG_SEED_MULTIPLIER + i1 * LCG_INDEX_MULTIPLIER + LCG_INCREMENT) / UINT32_MAX_VALUE) *
          RANDOM_SCORE_RANGE;
        const totalScore = partnerScore + bestOppScore + rnd;
        if (totalScore > bestScore) {
          bestScore = totalScore;
          if (matchIdx === 0) {
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p2, p3]
              },
              {
                team1: [p4, p5],
                team2: [p6, p7]
              }
            ];
          } else if (matchIdx === 1) {
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p4, p5]
              },
              {
                team1: [p2, p3],
                team2: [p6, p7]
              }
            ];
          } else {
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p6, p7]
              },
              {
                team1: [p2, p3],
                team2: [p4, p5]
              }
            ];
          }
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
    const expectedPlayers = this.opts.numberOfCourts * PLAYERS_PER_GAME;
    if (playingPlayers.length !== expectedPlayers) {
      throw new Error(`Round ${roundNum}: Expected ${expectedPlayers} players but got ${playingPlayers.length}`);
    }

    let matchings: Array<{ team1: [string, string]; team2: [string, string] }>;

    // For tight 2-court pools (only 2 sitters per round), exhaustively search all 105 partner
    // pairings × 3 matchup options = 315 total round arrangements. This finds the globally
    // optimal arrangement without the greedy's tunnel-vision bias.
    // Only applies when sittersPerRound ≤ 2 (dense schedule); larger pools use greedy.
    const activeTotalPlayers = this.players.filter(p => p.active !== false).length;
    const sittersPerRound = activeTotalPlayers - this.opts.numberOfCourts * PLAYERS_PER_GAME;
    if (
      sittersPerRound <= PAIR_SIZE &&
      playingPlayers.length === TWO_COURT_PLAYER_CAPACITY &&
      this.opts.numberOfCourts === PAIR_SIZE
    ) {
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
    // Create game objects
    for (let i = 0; i < courtAssignments.length; i += 1) {
      nextIteration3: {
        const assignment = courtAssignments[i];
        if (!assignment) {
          break nextIteration3;
        }
        const { team1, team2, court } = assignment;

        // Validate teams have players
        if (!team1[0] || !team1[1] || !team2[0] || !team2[1]) {
          console.error(`Round ${roundNum}, Court ${court}: Invalid team composition`, {
            team1,
            team2
          });
          throw new Error(`Invalid team composition in round ${roundNum}`);
        }
        const skillLevel1 = this.player(team1[0]).skillLevel + this.player(team1[1]).skillLevel;
        const skillLevel2 = this.player(team2[0]).skillLevel + this.player(team2[1]).skillLevel;
        games.push({
          court,
          id: `g-${roundNum}-${court}`,
          round: roundNum,
          skillDifference: Math.abs(skillLevel1 - skillLevel2),
          team1,
          team1SkillLevel: skillLevel1,
          team2,
          team2SkillLevel: skillLevel2
        });
      }
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
      // Find and pair all preferred partners who are both available
      for (let i = 0; i < available.length; i += 1) {
        nextIteration4: {
          const p1 = available[i];
          if (!p1 || paired.has(p1)) {
            break nextIteration4;
          }
          const player1 = this.player(p1);
          if (
            player1.partnerId &&
            available.includes(player1.partnerId) &&
            !paired.has(player1.partnerId) &&
            (partnerHistory[p1]?.[player1.partnerId] || 0) === 0
          ) {
            // A preferred partnership is a one-time requirement, not a reason to
            // repeat the same team throughout the event.
            pairs.push([p1, player1.partnerId]);
            paired.add(p1);
            paired.add(player1.partnerId);
          }
        }
      }

      // Remove paired players from available list

      // Remove paired players from available list
      for (const playerId of paired) {
        const index = available.indexOf(playerId);
        if (index !== -1) {
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
    const randomFactor =
      ((seed * SEEDED_SHUFFLE_MULTIPLIER + SEEDED_SHUFFLE_INCREMENT) % SEEDED_SHUFFLE_MODULUS) / SEEDED_SHUFFLE_MODULUS; // Simple PRNG

    // Simple PRNG

    while (available.length >= PAIR_SIZE) {
      nextIteration5: {
        const p1 = available.shift();
        if (!p1) {
          break nextIteration5; // Should never happen due to length check, but satisfies linter
        }

        // Find best partner for p1 (prefer someone they haven't played with)
        let bestPartner: string | null = null;
        let bestScore = -Infinity;
        for (let i = 0; i < available.length; i += 1) {
          nextIteration6: {
            const p2 = available[i];
            if (!p2) {
              break nextIteration6; // Skip if somehow undefined
            }
            let score = 0;

            // HIGHEST PRIORITY: Prefer new partners
            const playCount = partnerHistory[p1]?.[p2] || 0;
            if (playCount === 0) {
              score += NEW_PARTNER_REWARD; // Extremely high weight for new partners
            } else {
              // Exponentially penalize based on how many times they've played
              score -= PARTNER_REPEAT_PENALTY * CUBIC_PENALTY_BASE ** playCount; // Much stronger exponential penalty
            }

            // Secondary priority: Among new partners, prefer to pair frequent opponents together.
            // Making them partners this round prevents another opponent encounter.
            if (playCount === 0) {
              const oppCount = opponentHistory[p1]?.[p2] || 0;
              if (oppCount > 0) {
                // Bonus capped at 5000 so it only breaks ties among new-partner candidates
                score += Math.min(oppCount * OPPONENT_DIVERSITY_REWARD, MAX_OPPONENT_DIVERSITY_REWARD);
              }
            }

            // Tertiary priority: Balance the number of unique partners each player has
            const p1PartnerCount = Object.keys(partnerHistory[p1] || {}).length;
            const p2PartnerCount = Object.keys(partnerHistory[p2] || {}).length;
            const partnerCountDiff = Math.abs(p1PartnerCount - p2PartnerCount);
            score -= partnerCountDiff * STANDARD_SCORE_WEIGHT; // Prefer pairing players with similar partner counts

            // Consider skill balance if enabled
            if (this.opts.balanceSkillLevels) {
              const skill1 = this.player(p1).skillLevel;
              const skill2 = this.player(p2).skillLevel;
              const avgSkill = (skill1 + skill2) / PAIR_SIZE;
              // Prefer pairs with mid-range combined skill
              score +=
                (TARGET_AVERAGE_SKILL_LEVEL - Math.abs(avgSkill - TARGET_AVERAGE_SKILL_LEVEL)) *
                HIGH_DENSITY_MIN_ROUNDS;
            }

            // Add seed-based randomization for exploration (scaled by iteration)
            const randomComponent =
              (((seed + i * PLAYER_SEED_STRIDE + p2.charCodeAt(0)) * SEEDED_SHUFFLE_MULTIPLIER +
                SEEDED_SHUFFLE_INCREMENT) %
                SEEDED_SHUFFLE_MODULUS) /
              SEEDED_SHUFFLE_MODULUS;
            score += randomComponent * STANDARD_SCORE_WEIGHT * randomFactor; // Increased controlled randomness

            if (score > bestScore) {
              bestScore = score;
              bestPartner = p2;
            }
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
    while (available.length >= PAIR_SIZE) {
      nextIteration7: {
        const team1 = available.shift();
        const team2 = available.shift();
        if (!team1 || !team2) {
          break nextIteration7;
        }
        fallback.push({
          team1: [team1[0] || '', team1[1] || ''],
          team2: [team2[0] || '', team2[1] || '']
        });
      }
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
        return { matchings: [], score: 0 };
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

      for (let i = 1; i < remainingTeams.length; i += 1) {
        nextIteration8: {
          const team2 = remainingTeams[i];
          if (!team2) {
            break nextIteration8;
          }
          const matchupScore = this.scoreTeamMatchup(
            team1,
            team2,
            opponentHistory,
            recentOpponentHistory,
            enforceSkillLimit
          );
          if (matchupScore === null) {
            break nextIteration8;
          }
          const nextRemaining = remainingTeams.slice(1, i).concat(remainingTeams.slice(i + 1));
          const subSolution = solve(nextRemaining);
          if (!subSolution) {
            break nextIteration8;
          }
          const totalScore = matchupScore + subSolution.score;
          if (!best || totalScore > best.score) {
            best = {
              matchings: [
                {
                  team1: [team1[0] || '', team1[1] || ''],
                  team2: [team2[0] || '', team2[1] || '']
                },
                ...subSolution.matchings
              ],
              score: totalScore
            };
          }
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
      .map(team => PickleballMatcher.pairKey(team[0] || '', team[1] || ''))
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
      const twoRoundsAgoOpponents = recentHistory?.[recentHistory.length - PAIR_SIZE];

      for (const p2 of team2) {
        const count = opponentHistory[p1]?.[p2] || 0;
        opponentCount += count;
        if (count > 0) {
          repeatedMatchups += 1;
        }
        if (count > 1) {
          severeRepeatedMatchups += count - 1;
        }
        maxPairRepeat = Math.max(maxPairRepeat, count);

        if (lastRoundOpponents?.includes(p2)) {
          lastRoundRepeatCount += 1;
        }
        if (twoRoundsAgoOpponents?.includes(p2)) {
          twoRoundsAgoRepeatCount += 1;
        }
      }
    }

    let score = 0;

    if (repeatedMatchups === 0) {
      score += NEW_OPPONENT_REWARD * opponentPriority;
    } else {
      score -= repeatedMatchups * REPEATED_OPPONENT_PENALTY * opponentPriority;
      score -= severeRepeatedMatchups * SEVERE_OPPONENT_REPEAT_PENALTY * opponentPriority;
      score -= maxPairRepeat * maxPairRepeat * maxPairRepeat * MAX_OPPONENT_REPEAT_CUBIC_WEIGHT * opponentPriority;
    }

    score -= opponentCount * OPPONENT_REPEAT_COUNT_PENALTY * opponentPriority;
    score -= lastRoundRepeatCount * LAST_ROUND_OPPONENT_PENALTY * opponentPriority;
    score -= twoRoundsAgoRepeatCount * OPPONENT_REPEAT_COUNT_PENALTY * opponentPriority;

    if (this.opts.balanceSkillLevels) {
      score -= skillDiff * SKILL_DIFFERENCE_WEIGHT;
      if (!enforceSkillLimit && skillDiff > this.opts.maxSkillDifference) {
        score -= (skillDiff - this.opts.maxSkillDifference) * EXCESS_SKILL_DIFFERENCE_WEIGHT;
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
    const courtNumbers = Array.from({ length: this.opts.numberOfCourts }, (_, idx) => idx + 1);
    const permutations = this.permutations(courtNumbers).filter(permutation => permutation.length === matchings.length);

    let bestCourts = permutations[0] || courtNumbers;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const courts of permutations) {
      let penalty = 0;
      for (let matchingIdx = 0; matchingIdx < matchings.length; matchingIdx += 1) {
        const matching = matchings[matchingIdx];
        const court = courts[matchingIdx];
        if (matching && court !== undefined) {
          for (const pid of [...matching.team1, ...matching.team2]) {
            const history = courtHistory[pid] || [];
            const timesOnCourt = history.filter(previousCourt => previousCourt === court).length;
            penalty += timesOnCourt * COURT_USAGE_BALANCE_PENALTY * courtPriority;

            if (history.at(-1) === court) {
              penalty += SAME_COURT_PENALTY * courtPriority;
            }
            if (history.at(-1) === court && history.at(-PAIR_SIZE) === court) {
              penalty += SAME_COURT_STREAK_PENALTY * courtPriority;
            }
          }
        }
      }
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestCourts = courts;
      }
    }

    return matchings.map((matching, idx) => ({
      court: bestCourts[idx] || idx + 1,
      team1: matching.team1,
      team2: matching.team2
    }));
  }

  private permutations<T>(values: T[]): T[][] {
    if (values.length <= 1) {
      return [values];
    }
    const result: T[][] = [];
    for (let idx = 0; idx < values.length; idx += 1) {
      const value = values[idx];
      if (value !== undefined) {
        const remaining = [...values.slice(0, idx), ...values.slice(idx + 1)];
        for (const suffix of this.permutations(remaining)) {
          result.push([value, ...suffix]);
        }
      }
    }
    return result;
  }

  /**
   * Evaluate schedule with prioritized scoring.
   */
  private evaluateQuality(schedule: GameSchedule): number[] {
    return [
      this.scoreFirstRoundSitterViolations(schedule),
      this.scoreRestDistribution(schedule),
      this.scoreRestSpacing(schedule),
      this.opts.respectPartnerPreferences ? this.scoreCouplesPreference(schedule) : 0,
      this.scorePartnerRepeats(schedule),
      this.scoreOpponentRepeats(schedule),
      this.scoreOpponentsAboveTwo(schedule),
      this.scoreConsecutiveOpponents(schedule),
      this.scoreConsecutiveCourts(schedule),
      this.opts.balanceSkillLevels ? this.scoreMaxSkillDifferenceViolations(schedule) : 0,
      this.opts.balanceSkillLevels ? this.scoreSkillBalance(schedule) : 0
    ];
  }

  private compareQuality(first: number[], second: number[]): number {
    for (let idx = 0; idx < Math.max(first.length, second.length); idx += 1) {
      const difference = (first[idx] || 0) - (second[idx] || 0);
      if (Math.abs(difference) > Number.EPSILON) {
        return difference;
      }
    }
    return 0;
  }

  private scoreFirstRoundSitterViolations(schedule: GameSchedule): number {
    if (!this.opts.firstRoundSitters?.length) {
      return 0;
    }
    const required = new Set(this.opts.firstRoundSitters);
    const actual = new Set(schedule.restingPlayers[0] || []);
    let missing = 0;
    for (const playerId of required) {
      if (!actual.has(playerId)) {
        missing += 1;
      }
    }
    return missing;
  }

  private evaluateScore(schedule: GameSchedule): number {
    const opponentPriority = this.preferenceMultiplier(this.opts.opponentDiversityPriority);
    const courtPriority = this.preferenceMultiplier(this.opts.courtDiversityPriority);
    let score = 0;

    // PRIORITY 0: First round sitters must be respected (if specified)
    // This is enforced during construction, so we don't penalize here

    // PRIORITY 1: Even rest distribution (max difference of 1) - if enabled
    if (this.opts.distributeRestEqually) {
      score += this.scoreRestDistribution(schedule) * REST_DISTRIBUTION_WEIGHT;
    }

    // PRIORITY 2: Rest spacing (maximize distance between rests)
    score += this.scoreRestSpacing(schedule) * BASE_SEARCH_ITERATIONS;

    // PRIORITY 3: Minimize partner repeats (HIGHEST priority for gameplay)
    score += this.scorePartnerRepeats(schedule) * HIGH_DENSITY_SEARCH_ITERATIONS;

    // PRIORITY 4: Consecutive opponent penalties
    score += this.scoreConsecutiveOpponents(schedule) * CONSECUTIVE_OPPONENT_WEIGHT * opponentPriority;

    // PRIORITY 5: Minimize opponent repeats (overall)
    score += this.scoreOpponentRepeats(schedule) * OPPONENT_REPEAT_WEIGHT * opponentPriority;

    // PRIORITY 5b: Extra penalty for opponent encounters above 2 — sum of (count-2) per pair.
    // Sum-based scoring penalises concentration: a pair at count=4 costs twice as much as
    // a pair at count=3, which naturally keeps the maximum encounter depth low.
    // Weight 30000: a 2-unit avoidable difference contributes 60,000, reliably dominating
    // rest-spacing noise (~0-20k) and a count-2 partner repeat (~25,000) so the right seed
    // is selected consistently across runs.
    score += this.scoreOpponentsAboveTwo(schedule) * EXCESS_OPPONENT_REPEAT_WEIGHT * opponentPriority;

    // PRIORITY 6: Consecutive court penalties
    score += this.scoreConsecutiveCourts(schedule) * CONSECUTIVE_COURT_WEIGHT * courtPriority;

    // PRIORITY 7: Skill level balance (if enabled)
    if (this.opts.balanceSkillLevels) {
      score += this.scoreSkillBalance(schedule) * SKILL_BALANCE_WEIGHT;
      // Add penalty for games exceeding maxSkillDifference
      score += this.scoreMaxSkillDifferenceViolations(schedule) * STANDARD_SCORE_WEIGHT;
    }

    // PRIORITY 8: Couples play together (if enabled)
    // Weight 1000: 100,000 per unplayed couple — prevents local search from breaking preferred pairs
    if (this.opts.respectPartnerPreferences) {
      score += this.scoreCouplesPreference(schedule) * BASE_SEARCH_ITERATIONS;
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
        for (let i = 1; i < restRounds.length; i += 1) {
          const gap = Math.max(1, (restRounds[i] ?? 0) - (restRounds[i - 1] ?? 0));
          // Reciprocal-square cost strongly penalizes adjacent rests while still
          // distinguishing two evenly spaced plans with different absolute gaps.
          totalBadness += (schedule.rounds.length / gap) ** PAIR_SIZE;
        }
      }
    }

    return totalBadness;
  }

  private scorePartnerRepeats(schedule: GameSchedule): number {
    const partnerCounts: Record<string, number> = {};

    for (const round of schedule.rounds) {
      for (const game of round) {
        PickleballMatcher.bump(partnerCounts, game.team1[0], game.team1[1]);
        PickleballMatcher.bump(partnerCounts, game.team2[0], game.team2[1]);
      }
    }

    let penalty = 0;
    for (const count of Object.values(partnerCounts)) {
      if (count > 1) {
        // Much stronger exponential penalty for repeats
        penalty += HIGH_DENSITY_MIN_ROUNDS ** (count - 1);
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
            PickleballMatcher.bump(opponentCounts, p1, p2);
          }
        }
      }
    }

    let penalty = 0;
    for (const count of Object.values(opponentCounts)) {
      // Penalize every repeat; escalate rapidly as repeat count grows.
      if (count > 1) {
        penalty += PARTNER_REPEAT_EXPONENTIAL_BASE ** (count - 1);
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
            PickleballMatcher.bump(opponentCounts, p1, p2);
          }
        }
      }
    }

    let total = 0;
    for (const count of Object.values(opponentCounts)) {
      if (count > PAIR_SIZE) {
        total += count - PAIR_SIZE;
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
      for (let i = 1; i < opponentsByRound.length; i += 1) {
        const currentOpponents = opponentsByRound[i];
        const lastRoundOpponents = opponentsByRound[i - 1];

        // Large penalty if any opponent from last round appears again
        for (const opp of currentOpponents || []) {
          if (lastRoundOpponents?.includes(opp)) {
            penalty += STANDARD_SCORE_WEIGHT; // Heavy penalty for consecutive round
          }
        }

        // Check 2 rounds back (smaller penalty)
        if (i >= PAIR_SIZE) {
          const twoRoundsAgoOpponents = opponentsByRound[i - PAIR_SIZE];
          for (const opp of currentOpponents || []) {
            if (twoRoundsAgoOpponents?.includes(opp)) {
              penalty += CONSECUTIVE_COURT_WEIGHT; // Smaller penalty for 2 rounds ago
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
    let maxCourtRange = 0;

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
      for (let i = 1; i < courtHistory.length; i += 1) {
        if (courtHistory[i] === courtHistory[i - 1]) {
          penalty += RANDOM_SCORE_RANGE; // Penalty for playing on same court in consecutive rounds

          // Extra penalty if same court for 2 consecutive rounds
          if (i >= PAIR_SIZE && courtHistory[i] === courtHistory[i - PAIR_SIZE]) {
            penalty += STANDARD_SCORE_WEIGHT; // Additional penalty for 3 consecutive rounds on same court
          }
        }
      }

      // Also penalize long-term court concentration, not just streaks.
      // For a fixed number of games, the sum of squares is minimized when
      // appearances are distributed as evenly as possible across courts.
      const courtCounts = Array.from(
        { length: this.opts.numberOfCourts },
        (_, idx) => courtHistory.filter(court => court === idx + 1).length
      );
      const courtRange = Math.max(...courtCounts) - Math.min(...courtCounts);
      maxCourtRange = Math.max(maxCourtRange, courtRange);
      penalty += courtRange * COURT_DISTRIBUTION_RANGE_PENALTY;
      penalty += courtCounts.reduce((sum, count) => sum + count * count, 0) * COURT_DISTRIBUTION_VARIANCE_PENALTY;
    }

    return penalty + maxCourtRange * MAX_COURT_RANGE_PENALTY;
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
          violations += PAIR_SIZE ** excess;
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
        const key = PickleballMatcher.pairKey(player.id, player.partnerId);
        couplesPlayed[key] = false;
      }
    }

    // Check if couples played together
    for (const round of schedule.rounds) {
      for (const game of round) {
        const key1 = PickleballMatcher.pairKey(game.team1[0], game.team1[1]);
        const key2 = PickleballMatcher.pairKey(game.team2[0], game.team2[1]);

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
        penalty += STANDARD_SCORE_WEIGHT;
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
          count += 1;
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

    for (let pass = 0; pass < LOCAL_SEARCH_PASS_LIMIT; pass += 1) {
      // Compute current opponent counts
      const opponentCounts = new Map<string, number>();
      for (const round of current.rounds) {
        for (const game of round) {
          for (const p1 of game.team1) {
            for (const p2 of game.team2) {
              const key = PickleballMatcher.pairKey(p1, p2);
              opponentCounts.set(key, (opponentCounts.get(key) || 0) + 1);
            }
          }
        }
      }

      // Find hot pairs (encounter count ≥ 3), sorted by hottest first
      const hotPairs = Array.from(opponentCounts.entries())
        .filter(([, c]) => c >= CUBIC_PENALTY_BASE)
        .sort((a, b) => b[1] - a[1]);

      if (hotPairs.length === 0) {
        break;
      }

      let improved = false;

      for (const [pairKey, hotCount] of hotPairs) {
        nextIteration12: {
          const parts = pairKey.split('|');
          const id1 = parts[0];
          const id2 = parts[1];
          if (!id1 || !id2) {
            break nextIteration12;
          }

          // Find rounds where this pair faced each other as opponents
          for (let r = 0; r < current.rounds.length; r += 1) {
            nextIteration13: {
              const round = current.rounds[r];
              if (!round) {
                break nextIteration13;
              }
              const facingInRound = round.some(
                g =>
                  (g.team1.includes(id1) && g.team2.includes(id2)) || (g.team2.includes(id1) && g.team1.includes(id2))
              );
              if (!facingInRound) {
                break nextIteration13;
              }

              // Try all cross-game swaps in this round
              type Pos = {
                gi: number;
                ti: 0 | 1;
                pi: 0 | 1;
              };
              const positions: Pos[] = [];
              for (let gi = 0; gi < round.length; gi += 1) {
                positions.push(
                  {
                    gi,
                    pi: 0,
                    ti: 0
                  },
                  {
                    gi,
                    pi: 1,
                    ti: 0
                  },
                  {
                    gi,
                    pi: 0,
                    ti: 1
                  },
                  {
                    gi,
                    pi: 1,
                    ti: 1
                  }
                );
              }
              for (let i = 0; i < positions.length && !improved; i += 1) {
                for (let j = i + 1; j < positions.length && !improved; j += 1) {
                  nextIteration14: {
                    const a = positions[i];
                    const b = positions[j];
                    if (!a || !b || a.gi === b.gi) {
                      break nextIteration14;
                    }
                    const candidate = this.applySwap(current, r, a, b);
                    const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
                    if (newCount < hotCount) {
                      if (this.compareQuality(this.evaluateQuality(candidate), this.evaluateQuality(current)) >= 0) {
                        break nextIteration14;
                      }
                      const currPartner = this.scorePartnerRepeats(current);
                      const candPartner = this.scorePartnerRepeats(candidate);

                      // Reject if any partnership count would exceed 2 (count>2 penalty is 100+)
                      // Allow creating count-2 partnerships (penalty of 10 each) — these are
                      // within the test tolerances for small player pools with many rounds.
                      if (candPartner > currPartner) {
                        break nextIteration14;
                      }

                      // If partner preferences enabled, also protect couple pairings
                      if (this.opts.respectPartnerPreferences) {
                        const currCouples = this.scoreCouplesPreference(current);
                        const candCouples = this.scoreCouplesPreference(candidate);
                        if (candCouples > currCouples) {
                          break nextIteration14;
                        }
                      }
                      current = candidate;
                      improved = true;
                    }
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
                  for (let r2 = 0; r2 < current.rounds.length && !improved; r2 += 1) {
                    nextIteration15: {
                      if (r2 === r) {
                        break nextIteration15;
                      }
                      const sittersR2 = current.restingPlayers[r2] || [];
                      // id1 must be a sitter in r2, sitterIdInR must be a player in r2
                      if (!sittersR2.includes(id1)) {
                        break nextIteration15;
                      }
                      if (sittersR2.includes(sitterIdInR)) {
                        break nextIteration15;
                      }
                      // Rest-spacing guard: moving id1 from r2 to r must not create gap < 2.
                      // Also, moving sitterIdInR from r to r2 must not create gap < 2 for them.
                      const id1ViolatesSpacing = current.restingPlayers.some(
                        (sitters, ri) => ri !== r2 && sitters.includes(id1) && Math.abs(ri - r) < PAIR_SIZE
                      );
                      if (id1ViolatesSpacing) {
                        break nextIteration15;
                      }
                      const sitterViolatesSpacing = current.restingPlayers.some(
                        (sitters, ri) => ri !== r && sitters.includes(sitterIdInR) && Math.abs(ri - r2) < PAIR_SIZE
                      );
                      if (sitterViolatesSpacing) {
                        break nextIteration15;
                      }
                      const candidate = this.applyInterRoundSitterSwap(current, id1, sitterIdInR, r, r2);
                      const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
                      if (newCount < hotCount) {
                        if (this.compareQuality(this.evaluateQuality(candidate), this.evaluateQuality(current)) >= 0) {
                          break nextIteration15;
                        }
                        const currPartner = this.scorePartnerRepeats(current);
                        const candPartner = this.scorePartnerRepeats(candidate);
                        // Inter-round swaps affect partnerships in TWO rounds, so allow up to two new
                        // count-2 partnerships (penalty 10 each → threshold 25 covers both).
                        if (candPartner > currPartner) {
                          break nextIteration15;
                        }
                        // Reject if total opponent score doesn't improve — prevents creating new hot pairs
                        // and avoids "neutral" swap chains that can eventually produce count=4 pairs.
                        if (this.scoreOpponentRepeats(candidate) >= currOppScore) {
                          break nextIteration15;
                        }
                        if (this.opts.respectPartnerPreferences) {
                          if (this.scoreCouplesPreference(candidate) > this.scoreCouplesPreference(current)) {
                            break nextIteration15;
                          }
                        }
                        current = candidate;
                        improved = true;
                      }
                    }
                  }
                  if (improved) {
                    break;
                  }
                  // Try sitting id2 in round r instead
                  for (let r2 = 0; r2 < current.rounds.length && !improved; r2 += 1) {
                    nextIteration16: {
                      if (r2 === r) {
                        break nextIteration16;
                      }
                      const sittersR2 = current.restingPlayers[r2] || [];
                      if (!sittersR2.includes(id2)) {
                        break nextIteration16;
                      }
                      if (sittersR2.includes(sitterIdInR)) {
                        break nextIteration16;
                      }
                      // Rest-spacing guard: same checks as for id1 above.
                      const id2ViolatesSpacing = current.restingPlayers.some(
                        (sitters, ri) => ri !== r2 && sitters.includes(id2) && Math.abs(ri - r) < PAIR_SIZE
                      );
                      if (id2ViolatesSpacing) {
                        break nextIteration16;
                      }
                      const sitterViolatesSpacing2 = current.restingPlayers.some(
                        (sitters, ri) => ri !== r && sitters.includes(sitterIdInR) && Math.abs(ri - r2) < PAIR_SIZE
                      );
                      if (sitterViolatesSpacing2) {
                        break nextIteration16;
                      }
                      const candidate = this.applyInterRoundSitterSwap(current, id2, sitterIdInR, r, r2);
                      const newCount = this.countPairOpponentEncounters(candidate, id1, id2);
                      if (newCount < hotCount) {
                        if (this.compareQuality(this.evaluateQuality(candidate), this.evaluateQuality(current)) >= 0) {
                          break nextIteration16;
                        }
                        const currPartner = this.scorePartnerRepeats(current);
                        const candPartner = this.scorePartnerRepeats(candidate);
                        // Inter-round swaps affect partnerships in TWO rounds, so allow up to two new
                        // count-2 partnerships (penalty 10 each → threshold 25 covers both).
                        if (candPartner > currPartner) {
                          break nextIteration16;
                        }
                        // Reject if total opponent score doesn't improve — prevents creating new hot pairs
                        // and avoids "neutral" swap chains that can eventually produce count=4 pairs.
                        if (this.scoreOpponentRepeats(candidate) >= currOppScore) {
                          break nextIteration16;
                        }
                        if (this.opts.respectPartnerPreferences) {
                          if (this.scoreCouplesPreference(candidate) > this.scoreCouplesPreference(current)) {
                            break nextIteration16;
                          }
                        }
                        current = candidate;
                        improved = true;
                      }
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
          }
          if (improved) {
            break;
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
    if (!round || round.length !== PAIR_SIZE) {
      return null; // Only handle 2-court rounds
    }

    const playingInRound: string[] = round.flatMap(g => [...g.team1, ...g.team2]);
    if (playingInRound.length !== TWO_COURT_PLAYER_CAPACITY) {
      return null;
    }

    // Build opponent and partner histories from all OTHER rounds.
    const oppHistory: Record<string, Record<string, number>> = {};
    const partnerHistory: Record<string, Record<string, number>> = {};

    for (let r = 0; r < current.rounds.length; r += 1) {
      nextIteration17: {
        if (r === roundIdx) {
          break nextIteration17;
        }
        const roundAtR = current.rounds[r];
        if (!roundAtR) {
          break nextIteration17;
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
    }

    const indexPartitions = PickleballMatcher.getPairIndexPartitions(TWO_COURT_PLAYER_CAPACITY);
    const opPri = this.preferenceMultiplier(this.opts.opponentDiversityPriority);
    const emptyRecent: Record<string, string[][]> = {};

    let bestScore = -Infinity;
    let bestMatchings: { team1: [string, string]; team2: [string, string] }[] | null = null;

    for (const idxPart of indexPartitions) {
      nextIteration18: {
        const part0 = idxPart[0];
        const part1 = idxPart[1];
        const part2 = idxPart[PAIR_SIZE];
        const part3 = idxPart[CUBIC_PENALTY_BASE];
        if (!part0 || !part1 || !part2 || !part3) {
          break nextIteration18;
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
          break nextIteration18;
        }

        // Partner score: 4 pairs
        let partnerScore = 0;
        for (let pi = 0; pi < PLAYERS_PER_GAME; pi += 1) {
          const pa = pi === 0 ? p0 : pi === 1 ? p2 : pi === PAIR_SIZE ? p4 : p6;
          const pb = pi === 0 ? p1 : pi === 1 ? p3 : pi === PAIR_SIZE ? p5 : p7;
          const pc = partnerHistory[pa]?.[pb] || 0;
          partnerScore += pc === 0 ? NEW_PARTNER_REWARD : PREFERRED_PARTNER_REPEAT_PENALTY * CUBIC_PENALTY_BASE ** pc;
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
          const total = s + partnerScore * PARTNER_SCORE_TIEBREAKER_SCALE;
          if (total > bestScore) {
            bestScore = total;
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p2, p3]
              },
              {
                team1: [p4, p5],
                team2: [p6, p7]
              }
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
          const total = s + partnerScore * PARTNER_SCORE_TIEBREAKER_SCALE;
          if (total > bestScore) {
            bestScore = total;
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p4, p5]
              },
              {
                team1: [p2, p3],
                team2: [p6, p7]
              }
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
          const total = s + partnerScore * PARTNER_SCORE_TIEBREAKER_SCALE;
          if (total > bestScore) {
            bestScore = total;
            bestMatchings = [
              {
                team1: [p0, p1],
                team2: [p6, p7]
              },
              {
                team1: [p2, p3],
                team2: [p4, p5]
              }
            ];
          }
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
      return Object.assign({}, g, {
        skillDifference: Math.abs(s1 - s2),
        team1: m.team1,
        team1SkillLevel: s1,
        team2: m.team2,
        team2SkillLevel: s2
      });
    });
    const newRounds = [...current.rounds];
    newRounds[roundIdx] = newRound;
    const candidate: GameSchedule = Object.assign({}, current, {
      rounds: newRounds
    });

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
    if (candPartner > currPartner) {
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
    let s =
      (Math.abs(seed * SEEDED_SHUFFLE_MULTIPLIER + SEEDED_SHUFFLE_INCREMENT) % SEEDED_SHUFFLE_MODULUS) +
      SEEDED_SHUFFLE_INITIAL_OFFSET;
    for (let i = result.length - ARRAY_INDEX_OFFSET; i > FIRST_ARRAY_INDEX; i -= ARRAY_INDEX_OFFSET) {
      s = (s * SEEDED_SHUFFLE_MULTIPLIER + SEEDED_SHUFFLE_INCREMENT) % SEEDED_SHUFFLE_MODULUS;
      const j = Math.floor((s / SEEDED_SHUFFLE_MODULUS) * (i + ARRAY_INDEX_OFFSET));
      const tmp = result[i];
      result[i] = result[j] as T;
      result[j] = tmp as T;
    }
    return result;
  }

  /**
   * Re-label courts after all gameplay optimization is complete.
   * This cannot affect rests, partners, opponents, or skill balance, so it
   * safely improves the lowest-priority goal without trading away a higher one.
   */
  private improveCourtAssignments(schedule: GameSchedule): GameSchedule {
    let current = schedule;
    let currentCourtScore = this.scoreConsecutiveCourts(current);

    if (
      this.opts.numberOfCourts === PAIR_SIZE &&
      current.rounds.length <= MAX_EXHAUSTIVE_COURT_ROUNDS &&
      current.rounds.every(round => round.length === PAIR_SIZE)
    ) {
      const assignmentCount = PAIR_SIZE ** current.rounds.length;
      for (let assignment = 0; assignment < assignmentCount; assignment += 1) {
        const candidateRounds = current.rounds.map((round, roundIdx) => {
          const reverseCourts = (assignment & (1 << roundIdx)) !== 0;
          return round.map((game, gameIdx) => {
            const court = reverseCourts ? PAIR_SIZE - gameIdx : gameIdx + 1;
            return Object.assign({}, game, {
              court,
              id: `g-${game.round}-${court}`
            });
          });
        });
        const candidate = Object.assign({}, schedule, {
          rounds: candidateRounds
        });
        const candidateScore = this.scoreConsecutiveCourts(candidate);
        if (candidateScore < currentCourtScore) {
          current = candidate;
          currentCourtScore = candidateScore;
        }
      }
      return current;
    }

    const courtNumbers = Array.from({ length: this.opts.numberOfCourts }, (_, idx) => idx + 1);
    const courtPermutations = this.permutations(courtNumbers);

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      let improved = false;

      for (let roundIdx = 0; roundIdx < current.rounds.length; roundIdx += 1) {
        const round = current.rounds[roundIdx];
        if (round && round.length > 1) {
          let bestRound = round;
          let bestScore = currentCourtScore;
          for (const courts of courtPermutations) {
            const candidateRound = round.map((game, gameIdx) => {
              const court = courts[gameIdx] || game.court;
              return Object.assign({}, game, {
                court,
                id: `g-${game.round}-${court}`
              });
            });
            const candidateRounds = [...current.rounds];
            candidateRounds[roundIdx] = candidateRound;
            const candidate = Object.assign({}, current, {
              rounds: candidateRounds
            });
            const candidateScore = this.scoreConsecutiveCourts(candidate);
            if (candidateScore < bestScore) {
              bestRound = candidateRound;
              bestScore = candidateScore;
            }
          }

          if (bestRound !== round) {
            const improvedRounds = [...current.rounds];
            improvedRounds[roundIdx] = bestRound;
            current = Object.assign({}, current, {
              rounds: improvedRounds
            });
            currentCourtScore = bestScore;
            improved = true;
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
   * Post-construction local search: try swapping players between games within each round.
   * Accepts any swap that improves the total score. Runs multiple passes until no improvement.
   */
  private improveWithLocalSearch(schedule: GameSchedule): GameSchedule {
    let current = schedule;
    let currentQuality = this.evaluateQuality(current);

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      let improved = false;

      for (let roundIdx = 0; roundIdx < current.rounds.length; roundIdx += 1) {
        const round = current.rounds[roundIdx];
        if (round && round.length > 1) {
          // Enumerate all player positions in this round
          type Pos = { gi: number; ti: 0 | 1; pi: 0 | 1 };
          const positions: Pos[] = [];
          for (let gi = 0; gi < round.length; gi += 1) {
            positions.push({ gi, pi: 0, ti: 0 }, { gi, pi: 1, ti: 0 }, { gi, pi: 0, ti: 1 }, { gi, pi: 1, ti: 1 });
          }

          // Try all pairwise swaps between different games
          for (let i = 0; i < positions.length; i += 1) {
            for (let j = i + 1; j < positions.length; j += 1) {
              const a = positions[i];
              const b = positions[j];
              if (a && b && a.gi !== b.gi) {
                const candidate = this.applySwap(current, roundIdx, a, b);
                const quality = this.evaluateQuality(candidate);

                if (this.compareQuality(quality, currentQuality) < 0) {
                  current = candidate;
                  currentQuality = quality;
                  improved = true;
                }
              }
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
    const newRound = roundToSwap.map(g =>
      Object.assign({}, g, {
        team1: [g.team1[0], g.team1[1]] as [string, string],
        team2: [g.team2[0], g.team2[1]] as [string, string]
      })
    );

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
    return Object.assign({}, schedule, {
      rounds: newRounds
    });
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
      const roundCopy = roundAtR.map(g =>
        Object.assign({}, g, {
          team1: [g.team1[0], g.team1[1]] as [string, string],
          team2: [g.team2[0], g.team2[1]] as [string, string]
        })
      );
      for (const g of roundCopy) {
        const t1idx = g.team1.indexOf(playerToSit);
        const t2idx = g.team2.indexOf(playerToSit);
        if (t1idx !== -1) {
          g.team1[t1idx] = sitterToPlay;
        } else if (t2idx !== -1) {
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
      if (si !== -1) {
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
      const roundCopy = roundAtR2.map(g =>
        Object.assign({}, g, {
          team1: [g.team1[0], g.team1[1]] as [string, string],
          team2: [g.team2[0], g.team2[1]] as [string, string]
        })
      );
      for (const g of roundCopy) {
        const t1idx = g.team1.indexOf(sitterToPlay);
        const t2idx = g.team2.indexOf(sitterToPlay);
        if (t1idx !== -1) {
          g.team1[t1idx] = playerToSit;
        } else if (t2idx !== -1) {
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
      if (si2 !== -1) {
        sittersR2.splice(si2, 1);
      }
      sittersR2.push(sitterToPlay);
      newRestingPlayers[roundR2] = sittersR2;
    }

    return Object.assign({}, schedule, {
      restingPlayers: newRestingPlayers,
      rounds: newRounds
    });
  }

  // Helper utilities
  private player(id: string): Player {
    const player = this.players.find(player => player.id === id);
    if (!player) {
      throw new Error(`Unknown player id ${id}`);
    }
    return player;
  }

  private static pairKey(first: string, second: string): string {
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  }

  private static bump(store: Record<string, number>, first: string, second: string): void {
    const key = PickleballMatcher.pairKey(first, second);
    if (!store[key]) {
      store[key] = 0;
    }
    store[key] += 1;
  }
}
