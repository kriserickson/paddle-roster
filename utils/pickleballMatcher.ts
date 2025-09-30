import type { Player, Game, MatchingOptions, GameSchedule } from '~/types';
/*
 * PickleballMatcher – final trimmed version
 * --------------------------------------------------------------
 *  • Interfaces have been removed from this file to shrink size.
 *    Import them from your own `types.ts` (or wherever you keep
 *    the declarations) so the class remains strongly‑typed.
 *  • Logic, style rules (braces/newlines), infinite‑loop fixes,
 *    and score optimisation are unchanged.
 * --------------------------------------------------------------
 */

export class PickleballMatcher {
  constructor(
    private players: Player[],
    private opts: MatchingOptions
  ) {
    // no‑op
  }

  /**
   * Generate the best schedule found across `trials` random attempts.
   */
  public generateSchedule(eventLabel = 'Pickleball Tournament', trials = 1000): GameSchedule {
    let best: GameSchedule | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < trials; i++) {
      const candidate = this.buildSingleSchedule(eventLabel);
      const score = this.evaluateScore(candidate);
      candidate.score = score;
      if (score < bestScore) {
        console.log(`Try #${i + 1} – score: ${score} best: ${bestScore}`);
        best = candidate;
        bestScore = score;
      }
    }

    return best!;
  }

  // ---------------------------------------------------------------------
  // 1. Build a single random schedule
  // ---------------------------------------------------------------------
  private buildSingleSchedule(eventLabel: string): GameSchedule {
    const players = this.players.filter(p => {
      return p.active !== false;
    });

    const courts = this.opts.numberOfCourts;
    const perRound = courts * 4;

    if (players.length < perRound || players.length > perRound + 4) {
      throw new Error(`Player count ${players.length} invalid for ${courts} courts.`);
    }

    const partnerRounds = this.assignPartnerRounds(players, this.opts.numberOfRounds);

    const rests = this.buildRestMatrix(players, partnerRounds);

    const rounds: Game[][] = [];
    const usedPartners = new Set<string>();

    for (let r = 0; r < this.opts.numberOfRounds; r++) {
      const resting = new Set<string>(rests[r]);

      let playing = players
        .filter(p => {
          return !resting.has(p.id);
        })
        .map(p => {
          return p.id;
        });

      this.shuffle(playing);

      const teams: [string, string][] = [];

      // Mandatory partner teams
      if (partnerRounds.has(r)) {
        for (const [p1, p2] of partnerRounds.get(r)!) {
          if (!playing.includes(p1)) {
            playing.push(p1);
          }
          if (!playing.includes(p2)) {
            playing.push(p2);
          }
          playing = playing.filter(id => {
            return id !== p1 && id !== p2;
          });
          teams.push([p1, p2]);
          usedPartners.add(this.pairKey(p1, p2));
        }
      }

      // Form remaining teams
      if (this.opts.balanceSkillLevels) {
        const objs = playing.map(id => {
          return this.player(id);
        });
        objs.sort((a, b) => {
          return b.skillLevel - a.skillLevel;
        });
        while (objs.length > 0) {
          const hi = objs.shift()!;
          const lo = objs.pop()!;
          teams.push([hi.id, lo.id]);
        }
      } else {
        for (let i = 0; i < playing.length; i += 2) {
          teams.push([playing[i], playing[i + 1]]);
        }
      }

      // Pair teams into games & assign courts
      this.shuffle(teams);
      const games: Game[] = [];
      for (let t = 0; t < teams.length; t += 2) {
        const teamA = teams[t];
        const teamB = teams[t + 1];
        usedPartners.add(this.pairKey(...teamA));
        usedPartners.add(this.pairKey(...teamB));
        const skillA = this.player(teamA[0]).skillLevel + this.player(teamA[1]).skillLevel;
        const skillB = this.player(teamB[0]).skillLevel + this.player(teamB[1]).skillLevel;
        const flip = Math.random() < 0.5;
        const courtNum = t / 2 + 1;
        games.push({
          id: `g-${r + 1}-${courtNum}`,
          round: r + 1,
          court: courtNum,
          team1: flip ? teamB : teamA,
          team2: flip ? teamA : teamB,
          team1SkillLevel: flip ? skillB : skillA,
          team2SkillLevel: flip ? skillA : skillB,
          skillDifference: Math.abs(skillA - skillB)
        });
      }
      rounds.push(games);
    }

    return {
      rounds,
      restingPlayers: rests,
      eventLabel,
      options: this.opts,
      generatedAt: new Date()
    };
  }

  /**
   * Evaluate a candidate schedule and return a numeric penalty score (lower = better).
   *
   * Detailed rules and implementation notes:
   *
   * 1) Court concentration penalty
   *    - For each player and court we count how many times the player appears on that court
   *      across the whole schedule (courtHits[playerId][court]).
   *    - Penalty contribution for a single player/court is: Math.pow(count, 1.5).
   *      This penalises players who are overly concentrated on a single court; the
   *      exponent (1.5) makes the cost grow faster than linearly but less than quadratic.
   *
   * 2) Partner repeat penalties
   *    - partnerCounts[key] is incremented each time the unordered pair (a,b) are
   *      partners on the same team.
   *    - Let C = partnerCounts[key]. The number of repeats is repeats = C - 1.
   *      Only repeats > 0 produce a penalty.
   *    - Penalty formula: 20 * 2^(repeats - 1)
   *      Examples: C=1 -> 0 (no penalty), C=2 -> 20 (one repeat), C=3 -> 40, C=4 -> 80, ...
   *      This is a doubling scheme that heavily discourages the same partnership reoccurring.
   *
   * 3) Opponent repeat penalties
   *    - opponentCounts[key] is incremented each time an unordered pair of players have
   *      been on opposite teams in a game (i.e., one on team1 and the other on team2).
   *    - Penalty scheme (piecewise):
   *        C = 1 -> +10
   *        C = 2 -> +25
   *        C >= 3 -> 25 * 2^(C - 2)
   *      Examples: 1→10, 2→25, 3→50, 4→100, 5→200, ...
   *      This rewards variety in opponents and penalises repeated opponent matchups progressively.
   *
   * Implementation summary:
   *  - First pass over every round/game builds three maps: courtHits, partnerCounts, opponentCounts.
   *  - Next we add court concentration penalties (sum of count^1.5).
   *  - Then we apply partner repeat penalties (doubling scheme starting at 20 for the first repeat).
   *  - Finally we apply opponent repeat penalties (piecewise as above).
   *
   * Notes:
   *  - pairKey(a,b) creates an unordered key so pairs are order-insensitive.
   *  - bump(store,a,b) increments store[pairKey(a,b)] by 1 and creates the key if missing.
   *  - The returned numeric score has no fixed upper bound; it's used to compare schedules
   *    (lower score indicates a better schedule according to these heuristics).
   */
  private evaluateScore(schedule: GameSchedule): number {
    const courtHits: Record<string, Record<number, number>> = {};
    const partnerCounts: Record<string, number> = {};
    const opponentCounts: Record<string, number> = {};
    let score = 0;

    // Build counts: court assignments, partner pair frequencies, opponent pair frequencies
    for (const round of schedule.rounds) {
      for (const game of round) {
        const [a1, a2] = game.team1;
        const [b1, b2] = game.team2;
        // Track which court each player was on for concentration penalties
        for (const pid of [a1, a2, b1, b2]) {
          if (!courtHits[pid]) {
            courtHits[pid] = {};
          }
          if (!courtHits[pid][game.court]) {
            courtHits[pid][game.court] = 0;
          }
          courtHits[pid][game.court] += 1;
        }
        // Partner counts: each same-team pair increments partnerCounts
        this.bump(partnerCounts, a1, a2);
        this.bump(partnerCounts, b1, b2);
        // Opponent counts: every cross-team pairing increments opponentCounts
        for (const x of [a1, a2]) {
          for (const y of [b1, b2]) {
            this.bump(opponentCounts, x, y);
          }
        }
      }
    }

    // Apply court concentration penalty: sum over players & courts of count^1.5
    for (const pid in courtHits) {
      for (const court in courtHits[pid]) {
        score += Math.pow(courtHits[pid][court], 1.5);
      }
    }

    // Apply partner repeat penalties (doubling scheme)
    for (const key in partnerCounts) {
      const repeats = partnerCounts[key] - 1;
      if (repeats > 0) {
        score += 20 * Math.pow(2, repeats - 1);
      }
    }

    // Apply opponent repeat penalties (piecewise exponential after 2)
    for (const key in opponentCounts) {
      const count = opponentCounts[key];
      if (count >= 1) {
        if (count === 1) {
          score += 10;
        } else if (count === 2) {
          score += 25;
        } else {
          score += 25 * Math.pow(2, count - 2);
        }
      }
    }
    return score;
  }

  // ---------------------------------------------------------------------
  // 3. Rest matrix
  // ---------------------------------------------------------------------
  private buildRestMatrix(players: Player[], partnerRounds: Map<number, [string, string][]>): string[][] {
    const rounds = this.opts.numberOfRounds;
    const restEachRound = players.length - this.opts.numberOfCourts * 4;
    const matrix: string[][] = Array.from({ length: rounds }, () => {
      return [] as string[];
    });

    if (restEachRound === 0) {
      return matrix;
    }

    const totalRestSpots = restEachRound * rounds;
    const base = Math.floor(totalRestSpots / players.length);
    let extra = totalRestSpots % players.length;

    const need: Record<string, number> = Object.fromEntries(
      players.map(p => {
        return [p.id, base];
      })
    );

    if (extra > 0) {
      const order = players.map(p => {
        return p.id;
      });
      this.shuffle(order);
      for (const pid of order) {
        if (extra === 0) {
          break;
        }
        need[pid] += 1;
        extra -= 1;
      }
    }

    const lastRestRound: Record<string, number> = Object.fromEntries(
      players.map(p => {
        return [p.id, -Infinity];
      })
    );

    for (let r = 0; r < rounds; r++) {
      const blacklist = new Set<string>();
      if (partnerRounds.has(r)) {
        for (const [a, b] of partnerRounds.get(r)!) {
          blacklist.add(a);
          blacklist.add(b);
        }
      }

      const want = restEachRound;
      const roundRests: string[] = [];

      const candidates = players.filter(p => {
        return need[p.id] > 0 && !blacklist.has(p.id);
      });

      candidates.sort((a, b) => {
        return lastRestRound[a.id] - lastRestRound[b.id] || Math.random() - 0.5;
      });

      // Pass 1 – avoid consecutive rests
      for (const p of candidates) {
        if (roundRests.length === want) {
          break;
        }
        if (r > 0 && matrix[r - 1].includes(p.id)) {
          continue;
        }
        roundRests.push(p.id);
        need[p.id] -= 1;
        lastRestRound[p.id] = r;
      }

      // Pass 2 – allow consecutive if still needed
      if (roundRests.length < want) {
        for (const p of candidates) {
          if (roundRests.length === want) {
            break;
          }
          if (roundRests.includes(p.id)) {
            continue;
          }
          roundRests.push(p.id);
          need[p.id] -= 1;
          lastRestRound[p.id] = r;
        }
      }

      // Pass 3 – fallback: any non‑blacklisted player
      if (roundRests.length < want) {
        const fallback = players.filter(p => {
          return !blacklist.has(p.id) && !roundRests.includes(p.id);
        });
        this.shuffle(fallback);
        for (const p of fallback) {
          if (roundRests.length === want) {
            break;
          }
          roundRests.push(p.id);
          lastRestRound[p.id] = r;
        }
      }
      matrix[r] = roundRests;
    }
    return matrix;
  }

  // ---------------------------------------------------------------------
  // 4. Partner‑round assignment
  // ---------------------------------------------------------------------
  private assignPartnerRounds(players: Player[], rounds: number): Map<number, [string, string][]> {
    const map = new Map<number, [string, string][]>();
    if (!this.opts.respectPartnerPreferences) {
      return map;
    }

    const seen = new Set<string>();
    const pairs: [string, string][] = [];

    for (const p of players) {
      if (p.partnerId && !seen.has(p.id)) {
        const partner = players.find(x => {
          return x.id === p.partnerId;
        });
        if (partner) {
          pairs.push([p.id, partner.id]);
          seen.add(p.id);
          seen.add(partner.id);
        }
      }
    }

    this.shuffle(pairs);

    for (const pair of pairs) {
      let tries = 0;
      while (tries < 20) {
        const rnd = Math.floor(Math.random() * rounds);
        const arr = map.get(rnd) || [];
        if (arr.length < this.opts.numberOfCourts) {
          arr.push(pair);
          map.set(rnd, arr);
          break;
        }
        tries += 1;
      }
    }
    return map;
  }

  // ---------------------------------------------------------------------
  // 5. Helper utilities
  // ---------------------------------------------------------------------
  private player(id: string): Player {
    const p = this.players.find(x => {
      return x.id === id;
    });
    if (!p) {
      throw new Error(`Unknown player id ${id}`);
    }
    return p;
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
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
