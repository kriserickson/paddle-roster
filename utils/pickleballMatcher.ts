import type { Player, Game, MatchingOptions, GameSchedule } from '../types';

type Team = [string, string];

interface RoundBuildContext {
  partnerCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  courtUsage: Map<string, Map<number, number>>;
}

export class PickleballMatcher {
  private players: Player[];
  private options: MatchingOptions;

  constructor(players: Player[], options: MatchingOptions) {
    this.players = players;
    this.options = options;
  }

  public generateSchedule(eventLabel: string = 'Pickleball Tournament'): GameSchedule {
    const roundsToPlay = Math.max(0, this.options.numberOfRounds || 0);
    const activePlayers = this.players
      .filter(player => {
        return player.active !== false;
      })
      .map(player => {
        return { ...player };
      });

    activePlayers.sort((a, b) => {
      return a.id.localeCompare(b.id);
    });

    const skillMap = new Map<string, number>();
    const playerMap = new Map<string, Player>();
    for (const player of activePlayers) {
      skillMap.set(player.id, player.skillLevel ?? 0);
      playerMap.set(player.id, player);
    }

    const scheduleRounds: Game[][] = [];
    const scheduleRests: string[][] = [];

    if (roundsToPlay === 0) {
      return this.createScheduleResult(eventLabel, scheduleRounds, scheduleRests);
    }

    const effectiveCourts = this.computeEffectiveCourts(activePlayers.length);
    const restPerRound = this.computeRestPerRound(activePlayers.length, effectiveCourts);

    const preferredPairs = this.collectPreferredPairs(activePlayers);
    const preferredPairsByRound = this.distributePreferredPairs(preferredPairs, roundsToPlay);

    const restPlan = this.buildRestPlan(activePlayers, restPerRound, roundsToPlay, preferredPairsByRound);

    const roundContext: RoundBuildContext = {
      partnerCounts: new Map<string, number>(),
      opponentCounts: new Map<string, number>(),
      courtUsage: new Map<string, Map<number, number>>()
    };

    const maxSkillDifference = this.options.maxSkillDifference ?? 1000;

    for (let roundIndex = 0; roundIndex < roundsToPlay; roundIndex++) {
      const forcedPairs = preferredPairsByRound.get(roundIndex) ?? [];
      const restingThisRound = this.adjustRestForForcedPlayers(restPlan[roundIndex], forcedPairs, activePlayers);

      const playingIds = activePlayers
        .filter(player => {
          return !restingThisRound.includes(player.id);
        })
        .map(player => {
          return player.id;
        });

      if (playingIds.length < 4 || effectiveCourts === 0) {
        scheduleRounds.push([]);
        scheduleRests.push([...restingThisRound]);
        continue;
      }

      const roundPartnerCounts = new Map<string, number>();
      const workingPlayingIds = new Set<string>(playingIds);
      const teams: Team[] = [];

      for (const pair of forcedPairs) {
        const [a, b] = pair;
        if (workingPlayingIds.has(a) && workingPlayingIds.has(b)) {
          teams.push([a, b]);
          roundPartnerCounts.set(this.pairKey(a, b), 1);
          workingPlayingIds.delete(a);
          workingPlayingIds.delete(b);
        }
      }

      const remainingIds = Array.from(workingPlayingIds);
      remainingIds.sort((a, b) => {
        return a.localeCompare(b);
      });

      const additionalTeams = this.buildTeamsForRound(
        remainingIds,
        roundPartnerCounts,
        roundContext.partnerCounts,
        skillMap,
        maxSkillDifference
      );

      if (additionalTeams.teams.length === 0 && remainingIds.length > 0) {
        const fallbackTeams = this.buildFallbackTeams(remainingIds);
        teams.push(...fallbackTeams);
      } else {
        teams.push(...additionalTeams.teams);
      }

      const teamsNeeded = effectiveCourts * 2;
      const limitedTeams = teams.slice(0, teamsNeeded);

      const games = this.buildGamesForRound(
        limitedTeams,
        roundIndex,
        roundPartnerCounts,
        roundContext,
        skillMap,
        maxSkillDifference,
        effectiveCourts
      );

      for (const team of limitedTeams) {
        const key = this.pairKey(team[0], team[1]);
        roundContext.partnerCounts.set(key, (roundContext.partnerCounts.get(key) ?? 0) + 1);
      }

      scheduleRounds.push(games);
      scheduleRests.push([...restingThisRound]);
    }

    if (process.env.PADDLE_DEBUG_RESTS === '1') {
      const restHistory = new Map<string, number[]>();
      activePlayers.forEach(player => {
        restHistory.set(player.id, []);
      });
      scheduleRests.forEach((resters, roundIndex) => {
        resters.forEach(id => {
          restHistory.get(id)?.push(roundIndex);
        });
      });
      console.log('Actual rest history', restHistory);
    }

    return this.createScheduleResult(eventLabel, scheduleRounds, scheduleRests);
  }

  private createScheduleResult(eventLabel: string, rounds: Game[][], rests: string[][]): GameSchedule {
    return {
      rounds,
      restingPlayers: rests,
      eventLabel,
      options: this.options,
      generatedAt: new Date()
    };
  }

  private collectPreferredPairs(players: Player[]): Team[] {
    if (!this.options.respectPartnerPreferences) {
      return [];
    }

    const pairs: Team[] = [];
    const seen = new Set<string>();
    for (const player of players) {
      if (player.partnerId && !seen.has(player.id)) {
        const partner = players.find(candidate => {
          return candidate.id === player.partnerId;
        });
        if (partner) {
          pairs.push([player.id, partner.id]);
          seen.add(player.id);
          seen.add(partner.id);
        }
      }
    }
    return pairs;
  }

  private distributePreferredPairs(pairs: Team[], rounds: number): Map<number, Team[]> {
    const distribution = new Map<number, Team[]>();
    if (rounds === 0 || pairs.length === 0) {
      return distribution;
    }
    for (let index = 0; index < pairs.length; index++) {
      const roundIndex = index % rounds;
      if (!distribution.has(roundIndex)) {
        distribution.set(roundIndex, []);
      }
      distribution.get(roundIndex)!.push(pairs[index]);
    }
    return distribution;
  }

  private computeEffectiveCourts(playerCount: number): number {
    if (playerCount < 4) {
      return 0;
    }
    const maxCourts = this.options.numberOfCourts ?? 1;
    return Math.min(maxCourts, Math.floor(playerCount / 4));
  }

  private computeRestPerRound(playerCount: number, effectiveCourts: number): number {
    if (effectiveCourts === 0) {
      return playerCount;
    }
    const capacity = effectiveCourts * 4;
    return Math.max(0, playerCount - capacity);
  }

  private buildRestPlan(
    players: Player[],
    restEachRound: number,
    rounds: number,
    preferredPairsByRound: Map<number, Team[]>
  ): string[][] {
    const plan: string[][] = Array.from({ length: rounds }, () => {
      return [] as string[];
    });

    if (restEachRound <= 0 || rounds === 0 || players.length === 0) {
      return plan;
    }

    const baseRestNeeds = this.computeBaseRestNeeds(players, restEachRound, rounds);
    const minGap = rounds >= 8 ? 3 : 2;
    const forcedPlayersByRound = this.computeForcedPlayersByRound(rounds, preferredPairsByRound);

    const searchPlan = this.tryBuildRestPlanWithSearch(
      players,
      restEachRound,
      rounds,
      new Map(baseRestNeeds),
      forcedPlayersByRound,
      minGap
    );

    if (searchPlan) {
      return searchPlan;
    }

    return this.buildRestPlanGreedy(
      players,
      restEachRound,
      rounds,
      preferredPairsByRound,
      new Map(baseRestNeeds),
      minGap
    );
  }

  private computeBaseRestNeeds(players: Player[], restEachRound: number, rounds: number): Map<string, number> {
    const restNeeded = new Map<string, number>();
    if (restEachRound <= 0 || rounds === 0 || players.length === 0) {
      return restNeeded;
    }

    const totalRestSpots = restEachRound * rounds;
    const baseRests = Math.floor(totalRestSpots / players.length);
    let remainder = totalRestSpots % players.length;

    for (const player of players) {
      const additional = remainder > 0 ? 1 : 0;
      restNeeded.set(player.id, baseRests + additional);
      if (remainder > 0) {
        remainder -= 1;
      }
    }

    return restNeeded;
  }

  private computeForcedPlayersByRound(
    rounds: number,
    preferredPairsByRound: Map<number, Team[]>
  ): Map<number, Set<string>> {
    const forcedMap = new Map<number, Set<string>>();
    for (let round = 0; round < rounds; round++) {
      const pairs = preferredPairsByRound.get(round) ?? [];
      const forcedSet = new Set<string>();
      for (const pair of pairs) {
        forcedSet.add(pair[0]);
        forcedSet.add(pair[1]);
      }
      forcedMap.set(round, forcedSet);
    }
    return forcedMap;
  }

  private tryBuildRestPlanWithSearch(
    players: Player[],
    restEachRound: number,
    rounds: number,
    restNeeded: Map<string, number>,
    forcedPlayersByRound: Map<number, Set<string>>,
    minGap: number
  ): string[][] | null {
    if (rounds === 0) {
      return [];
    }

    const plan: string[][] = Array.from({ length: rounds }, () => {
      return [] as string[];
    });

    const lastRestRound = new Map<string, number>();
    const playerIds = players.map(player => {
      return player.id;
    });
    const forcedRoundsPerPlayer = new Map<string, number[]>();

    for (const id of playerIds) {
      forcedRoundsPerPlayer.set(id, []);
    }

    forcedPlayersByRound.forEach((forcedSet, roundIndex) => {
      forcedSet.forEach(id => {
        const roundsForPlayer = forcedRoundsPerPlayer.get(id);
        if (roundsForPlayer) {
          roundsForPlayer.push(roundIndex);
        }
      });
    });

    forcedRoundsPerPlayer.forEach(roundList => {
      roundList.sort((a, b) => {
        return a - b;
      });
    });

    const visitedStates = new Set<string>();

    const totalRestSlots = restEachRound * rounds;
    let initialNeedSum = 0;
    restNeeded.forEach(value => {
      initialNeedSum += value;
    });

    if (initialNeedSum !== totalRestSlots) {
      return null;
    }

    const assignSuccessful = this.assignRestRounds(
      0,
      rounds,
      restEachRound,
      restNeeded,
      lastRestRound,
      forcedPlayersByRound,
      forcedRoundsPerPlayer,
      minGap,
      plan,
      playerIds,
      visitedStates
    );

    if (assignSuccessful) {
      return plan;
    }

    return null;
  }

  private assignRestRounds(
    roundIndex: number,
    rounds: number,
    restEachRound: number,
    restNeeded: Map<string, number>,
    lastRestRound: Map<string, number>,
    forcedPlayersByRound: Map<number, Set<string>>,
    forcedRoundsPerPlayer: Map<string, number[]>,
    minGap: number,
    plan: string[][],
    playerIds: string[],
    visitedStates: Set<string>
  ): boolean {
    if (roundIndex === rounds) {
      for (const id of playerIds) {
        if ((restNeeded.get(id) ?? 0) !== 0) {
          return false;
        }
      }
      return true;
    }

    const stateKey = this.restStateKey(roundIndex, restNeeded, lastRestRound, playerIds);
    if (visitedStates.has(stateKey)) {
      return false;
    }

    const forcedSet = forcedPlayersByRound.get(roundIndex) ?? new Set<string>();
    const availableCandidates = playerIds.filter(id => {
      if (forcedSet.has(id)) {
        return false;
      }
      return (restNeeded.get(id) ?? 0) > 0;
    });

    if (availableCandidates.length < restEachRound) {
      visitedStates.add(stateKey);
      return false;
    }

    const eligible = availableCandidates.filter(id => {
      const lastRound = lastRestRound.get(id);
      if (lastRound === undefined) {
        return true;
      }
      return roundIndex - lastRound >= minGap;
    });

    if (eligible.length < restEachRound) {
      visitedStates.add(stateKey);
      return false;
    }

    const orderedEligible = this.orderEligibleCandidates(
      roundIndex,
      eligible,
      restNeeded,
      lastRestRound,
      forcedRoundsPerPlayer
    );

    const selection: string[] = [];
    const chosenSet = new Set<string>();

    const chooseSuccessful = this.chooseRestCombination(
      roundIndex,
      orderedEligible,
      0,
      restEachRound,
      selection,
      chosenSet,
      restNeeded,
      lastRestRound,
      forcedPlayersByRound,
      forcedRoundsPerPlayer,
      minGap,
      plan,
      playerIds,
      visitedStates
    );

    if (chooseSuccessful) {
      return true;
    }

    visitedStates.add(stateKey);
    return false;
  }

  private restStateKey(
    roundIndex: number,
    restNeeded: Map<string, number>,
    lastRestRound: Map<string, number>,
    playerIds: string[]
  ): string {
    const restParts: string[] = [];
    const lastParts: string[] = [];

    for (const id of playerIds) {
      restParts.push(String(restNeeded.get(id) ?? 0));
      const last = lastRestRound.get(id);
      lastParts.push(last === undefined ? '-1' : String(last));
    }

    return `${roundIndex}|${restParts.join(',')}|${lastParts.join(',')}`;
  }

  private orderEligibleCandidates(
    roundIndex: number,
    candidateIds: string[],
    restNeeded: Map<string, number>,
    lastRestRound: Map<string, number>,
    forcedRoundsPerPlayer: Map<string, number[]>
  ): string[] {
    const scored = candidateIds.map(id => {
      const remaining = restNeeded.get(id) ?? 0;
      const lastRound = lastRestRound.get(id);
      const gap = lastRound === undefined ? Number.POSITIVE_INFINITY : roundIndex - lastRound;
      const forcedRounds = forcedRoundsPerPlayer.get(id) ?? [];
      let nextForced = Number.POSITIVE_INFINITY;
      for (const forcedRound of forcedRounds) {
        if (forcedRound >= roundIndex) {
          nextForced = forcedRound;
          break;
        }
      }
      return {
        id,
        remaining,
        gap,
        nextForced
      };
    });

    scored.sort((a, b) => {
      if (b.remaining !== a.remaining) {
        return b.remaining - a.remaining;
      }
      if (b.gap !== a.gap) {
        return b.gap - a.gap;
      }
      if (a.nextForced !== b.nextForced) {
        return a.nextForced - b.nextForced;
      }
      return a.id.localeCompare(b.id);
    });

    return scored.map(item => {
      return item.id;
    });
  }

  private chooseRestCombination(
    roundIndex: number,
    orderedEligible: string[],
    startIndex: number,
    restEachRound: number,
    selection: string[],
    chosenSet: Set<string>,
    restNeeded: Map<string, number>,
    lastRestRound: Map<string, number>,
    forcedPlayersByRound: Map<number, Set<string>>,
    forcedRoundsPerPlayer: Map<string, number[]>,
    minGap: number,
    plan: string[][],
    playerIds: string[],
    visitedStates: Set<string>
  ): boolean {
    if (selection.length === restEachRound) {
      const previousLast = new Map<string, number | undefined>();
      for (const id of selection) {
        const currentRemaining = restNeeded.get(id) ?? 0;
        restNeeded.set(id, currentRemaining - 1);
        previousLast.set(id, lastRestRound.get(id));
        lastRestRound.set(id, roundIndex);
      }

      const remainingNeed = this.sumRemainingRest(restNeeded, playerIds);
      const remainingRounds = plan.length - (roundIndex + 1);
      const remainingSlots = remainingRounds * restEachRound;

      let feasible = true;
      if (remainingNeed > remainingSlots) {
        feasible = false;
      }

      if (feasible) {
        for (const id of playerIds) {
          const need = restNeeded.get(id) ?? 0;
          if (need <= 0) {
            continue;
          }
          const nextEligible = this.nextEligibleRoundForPlayer(lastRestRound.get(id), minGap);
          const available = this.countAvailableFutureRounds(
            roundIndex + 1,
            plan.length,
            nextEligible,
            forcedPlayersByRound,
            id
          );
          if (available < need) {
            feasible = false;
            break;
          }
        }
      }

      if (feasible) {
        const sortedSelection = [...selection];
        sortedSelection.sort((a, b) => {
          return a.localeCompare(b);
        });
        plan[roundIndex] = sortedSelection;
        const success = this.assignRestRounds(
          roundIndex + 1,
          plan.length,
          restEachRound,
          restNeeded,
          lastRestRound,
          forcedPlayersByRound,
          forcedRoundsPerPlayer,
          minGap,
          plan,
          playerIds,
          visitedStates
        );

        if (success) {
          return true;
        }

        plan[roundIndex] = [];
      }

      for (const id of selection) {
        const previous = previousLast.get(id);
        const currentRemaining = restNeeded.get(id) ?? 0;
        restNeeded.set(id, currentRemaining + 1);
        if (previous === undefined) {
          lastRestRound.delete(id);
        } else {
          lastRestRound.set(id, previous);
        }
      }

      return false;
    }

    const remainingSlots = restEachRound - selection.length;
    const availableRemaining = orderedEligible.length - startIndex;
    if (availableRemaining < remainingSlots) {
      return false;
    }

    for (let index = startIndex; index < orderedEligible.length; index += 1) {
      const id = orderedEligible[index];
      if (chosenSet.has(id)) {
        continue;
      }

      selection.push(id);
      chosenSet.add(id);

      const advanced = this.chooseRestCombination(
        roundIndex,
        orderedEligible,
        index + 1,
        restEachRound,
        selection,
        chosenSet,
        restNeeded,
        lastRestRound,
        forcedPlayersByRound,
        forcedRoundsPerPlayer,
        minGap,
        plan,
        playerIds,
        visitedStates
      );

      if (advanced) {
        return true;
      }

      chosenSet.delete(id);
      selection.pop();
    }

    return false;
  }

  private sumRemainingRest(restNeeded: Map<string, number>, playerIds: string[]): number {
    let total = 0;
    for (const id of playerIds) {
      total += restNeeded.get(id) ?? 0;
    }
    return total;
  }

  private nextEligibleRoundForPlayer(lastRest: number | undefined, minGap: number): number {
    if (lastRest === undefined) {
      return 0;
    }
    return lastRest + minGap;
  }

  private countAvailableFutureRounds(
    startRound: number,
    totalRounds: number,
    nextEligibleRound: number,
    forcedPlayersByRound: Map<number, Set<string>>,
    playerId: string
  ): number {
    let available = 0;
    for (let round = startRound; round < totalRounds; round += 1) {
      if (round < nextEligibleRound) {
        continue;
      }
      const forcedSet = forcedPlayersByRound.get(round);
      if (forcedSet && forcedSet.has(playerId)) {
        continue;
      }
      available += 1;
    }
    return available;
  }

  private buildRestPlanGreedy(
    players: Player[],
    restEachRound: number,
    rounds: number,
    preferredPairsByRound: Map<number, Team[]>,
    restNeeded: Map<string, number>,
    minGap: number
  ): string[][] {
    const plan: string[][] = Array.from({ length: rounds }, () => {
      return [] as string[];
    });

    if (restEachRound <= 0 || rounds === 0 || players.length === 0) {
      return plan;
    }

    const lastRestRound = new Map<string, number>();
    const nextEligibleRound = new Map<string, number>();

    for (const player of players) {
      nextEligibleRound.set(player.id, 0);
    }

    for (let round = 0; round < rounds; round += 1) {
      const forcedPlayers = new Set<string>();
      const forcedPairs = preferredPairsByRound.get(round) ?? [];
      for (const pair of forcedPairs) {
        forcedPlayers.add(pair[0]);
        forcedPlayers.add(pair[1]);
      }

      const selection: string[] = [];

      const candidates = players.filter(player => {
        return !forcedPlayers.has(player.id);
      });

      const positiveNeed = candidates
        .filter(player => {
          return (restNeeded.get(player.id) ?? 0) > 0;
        })
        .map(player => {
          return player.id;
        });

      const eligible = positiveNeed.filter(id => {
        return (nextEligibleRound.get(id) ?? 0) <= round;
      });

      eligible.sort((a, b) => {
        const needDiff = (restNeeded.get(b) ?? 0) - (restNeeded.get(a) ?? 0);
        if (needDiff !== 0) {
          return needDiff;
        }
        const gapA = round - (lastRestRound.get(a) ?? -1000);
        const gapB = round - (lastRestRound.get(b) ?? -1000);
        if (gapA !== gapB) {
          return gapB - gapA;
        }
        return a.localeCompare(b);
      });

      for (const candidate of eligible) {
        if (selection.length >= restEachRound) {
          break;
        }
        selection.push(candidate);
      }

      if (selection.length < restEachRound) {
        const deferred = positiveNeed
          .filter(id => {
            return !selection.includes(id);
          })
          .sort((a, b) => {
            const eligibleRoundDiff = (nextEligibleRound.get(a) ?? 0) - (nextEligibleRound.get(b) ?? 0);
            if (eligibleRoundDiff !== 0) {
              return eligibleRoundDiff;
            }
            const needDiff = (restNeeded.get(b) ?? 0) - (restNeeded.get(a) ?? 0);
            if (needDiff !== 0) {
              return needDiff;
            }
            return a.localeCompare(b);
          });

        for (const candidate of deferred) {
          if (selection.length >= restEachRound) {
            break;
          }
          selection.push(candidate);
        }
      }

      if (selection.length < restEachRound) {
        const fallback = candidates
          .map(player => {
            return player.id;
          })
          .filter(id => {
            return !selection.includes(id);
          })
          .sort((a, b) => {
            const gapA = round - (lastRestRound.get(a) ?? -1000);
            const gapB = round - (lastRestRound.get(b) ?? -1000);
            if (gapA !== gapB) {
              return gapB - gapA;
            }
            return a.localeCompare(b);
          });

        for (const candidate of fallback) {
          if (selection.length >= restEachRound) {
            break;
          }
          selection.push(candidate);
        }
      }

      selection.sort((a, b) => {
        return a.localeCompare(b);
      });

      for (const id of selection) {
        const remaining = restNeeded.get(id) ?? 0;
        if (remaining > 0) {
          restNeeded.set(id, remaining - 1);
        }
        lastRestRound.set(id, round);
        nextEligibleRound.set(id, round + minGap);
      }

      plan[round] = selection;
    }

    if (process.env.PADDLE_DEBUG_RESTS === '1') {
      console.log('Rest plan debug (greedy fallback)', plan);
    }

    return plan;
  }

  private adjustRestForForcedPlayers(resters: string[], forcedPairs: Team[], players: Player[]): string[] {
    if (resters.length === 0 || forcedPairs.length === 0) {
      return resters;
    }

    const adjusted = new Set<string>(resters);
    const playerIds = players.map(player => {
      return player.id;
    });

    for (const pair of forcedPairs) {
      for (const member of pair) {
        if (adjusted.has(member)) {
          adjusted.delete(member);
          for (const candidate of playerIds) {
            if (!adjusted.has(candidate) && !pair.includes(candidate)) {
              adjusted.add(candidate);
              break;
            }
          }
        }
      }
    }

    return Array.from(adjusted);
  }

  private buildTeamsForRound(
    remainingIds: string[],
    roundPartnerCounts: Map<string, number>,
    partnerCounts: Map<string, number>,
    skillMap: Map<string, number>,
    maxSkillDifference: number
  ): { teams: Team[] } {
    if (remainingIds.length === 0) {
      return { teams: [] };
    }

    let bestScore = Number.POSITIVE_INFINITY;
    let bestTeams: Team[] = [];
    const currentTeams: Team[] = [];
    const roundCounts = new Map<string, number>(roundPartnerCounts);

    const sortedIds = [...remainingIds];

    const recurse = (available: string[], accumulatedScore: number): void => {
      if (available.length === 0) {
        if (accumulatedScore < bestScore) {
          bestScore = accumulatedScore;
          bestTeams = currentTeams.map(team => {
            return [team[0], team[1]];
          });
        }
        return;
      }

      const first = available[0];
      for (let index = 1; index < available.length; index++) {
        const candidate = available[index];
        const pairKey = this.pairKey(first, candidate);
        const previous = (partnerCounts.get(pairKey) ?? 0) + (roundCounts.get(pairKey) ?? 0);
        let pairPenalty = 0;
        if (previous >= 1) {
          pairPenalty += Math.pow(4, previous) * 5000;
        }
        if (previous >= 2) {
          pairPenalty += 50000;
        }

        const skillA = skillMap.get(first) ?? 0;
        const skillB = skillMap.get(candidate) ?? 0;
        const skillDiff = Math.abs(skillA - skillB);
        pairPenalty += Math.abs(skillDiff - maxSkillDifference / 2) * 50;

        if (skillDiff > maxSkillDifference + 0.25) {
          pairPenalty += 100000 + (skillDiff - maxSkillDifference) * 10000;
        }

        const nextScore = accumulatedScore + pairPenalty;
        if (nextScore >= bestScore) {
          continue;
        }

        currentTeams.push([first, candidate]);
        roundCounts.set(pairKey, (roundCounts.get(pairKey) ?? 0) + 1);

        const nextAvailable = available.slice(1, index).concat(available.slice(index + 1));
        recurse(nextAvailable, nextScore);

        currentTeams.pop();
        const newCount = (roundCounts.get(pairKey) ?? 1) - 1;
        if (newCount <= 0) {
          roundCounts.delete(pairKey);
        } else {
          roundCounts.set(pairKey, newCount);
        }
      }
    };

    recurse(sortedIds, 0);

    return { teams: bestTeams };
  }

  private buildFallbackTeams(remainingIds: string[]): Team[] {
    const teams: Team[] = [];
    const ids = [...remainingIds];
    while (ids.length >= 2) {
      const a = ids.shift()!;
      const b = ids.pop() ?? ids.shift()!;
      teams.push([a, b]);
    }
    return teams;
  }

  private buildGamesForRound(
    teams: Team[],
    roundIndex: number,
    roundPartnerCounts: Map<string, number>,
    context: RoundBuildContext,
    skillMap: Map<string, number>,
    maxSkillDifference: number,
    effectiveCourts: number
  ): Game[] {
    if (teams.length < 2) {
      return [];
    }

    const used = new Array<boolean>(teams.length).fill(false);
    const bestGames: { list: Array<{ a: number; b: number }>; score: number } = {
      list: [],
      score: Number.POSITIVE_INFINITY
    };

    const roundOpponentCounts = new Map<string, number>();
    const roundCourtUsage = new Map<string, Map<number, number>>();

    function pairOpponentKey(playerA: string, playerB: string): string {
      return playerA < playerB ? `${playerA}|${playerB}` : `${playerB}|${playerA}`;
    }

    function ensureCourtUsage(playerId: string): Map<number, number> {
      if (!roundCourtUsage.has(playerId)) {
        roundCourtUsage.set(playerId, new Map<number, number>());
      }
      return roundCourtUsage.get(playerId)!;
    }

    function ensureHistoricalCourtUsage(playerId: string): Map<number, number> {
      if (!context.courtUsage.has(playerId)) {
        context.courtUsage.set(playerId, new Map<number, number>());
      }
      return context.courtUsage.get(playerId)!;
    }

    function explore(current: Array<{ a: number; b: number }>, accumulated: number): void {
      const gameIndex = current.length;
      if (gameIndex === teams.length / 2 || gameIndex === effectiveCourts) {
        if (accumulated < bestGames.score) {
          bestGames.list = current.map(match => {
            return { a: match.a, b: match.b };
          });
          bestGames.score = accumulated;
        }
        return;
      }

      let firstIndex = -1;
      for (let index = 0; index < teams.length; index++) {
        if (!used[index]) {
          firstIndex = index;
          break;
        }
      }

      if (firstIndex === -1) {
        return;
      }

      used[firstIndex] = true;
      for (let secondIndex = firstIndex + 1; secondIndex < teams.length; secondIndex++) {
        if (used[secondIndex]) {
          continue;
        }

        const courtNumber = gameIndex + 1;
        const teamA = teams[firstIndex];
        const teamB = teams[secondIndex];

        let penalty = 0;

        const crossPairs: Array<[string, string]> = [
          [teamA[0], teamB[0]],
          [teamA[0], teamB[1]],
          [teamA[1], teamB[0]],
          [teamA[1], teamB[1]]
        ];

        for (const [playerX, playerY] of crossPairs) {
          const key = pairOpponentKey(playerX, playerY);
          const previous = (context.opponentCounts.get(key) ?? 0) + (roundOpponentCounts.get(key) ?? 0);
          if (previous >= 2) {
            penalty += 75000 * (previous - 1);
          }
          penalty += previous * 5000;
        }

        const teamASkill = (skillMap.get(teamA[0]) ?? 0) + (skillMap.get(teamA[1]) ?? 0);
        const teamBSkill = (skillMap.get(teamB[0]) ?? 0) + (skillMap.get(teamB[1]) ?? 0);
        const teamAAverage = teamASkill / 2;
        const teamBAverage = teamBSkill / 2;
        const skillDiff = Math.abs(teamAAverage - teamBAverage);

        if (skillDiff > maxSkillDifference + 1e-6) {
          penalty += 250000 + (skillDiff - maxSkillDifference) * 25000;
        } else {
          penalty += skillDiff * 250;
        }

        const participants = [teamA[0], teamA[1], teamB[0], teamB[1]];
        for (const participant of participants) {
          const historical = ensureHistoricalCourtUsage(participant);
          const roundUsage = ensureCourtUsage(participant);
          const prior = (historical.get(courtNumber) ?? 0) + (roundUsage.get(courtNumber) ?? 0);
          penalty += prior * 200;
        }

        const nextScore = accumulated + penalty;
        if (nextScore >= bestGames.score) {
          continue;
        }

        current.push({ a: firstIndex, b: secondIndex });
        used[secondIndex] = true;

        for (const [playerX, playerY] of crossPairs) {
          const key = pairOpponentKey(playerX, playerY);
          roundOpponentCounts.set(key, (roundOpponentCounts.get(key) ?? 0) + 1);
        }

        for (const participant of participants) {
          const usage = ensureCourtUsage(participant);
          usage.set(courtNumber, (usage.get(courtNumber) ?? 0) + 1);
        }

        explore(current, nextScore);

        current.pop();
        used[secondIndex] = false;

        for (const [playerX, playerY] of crossPairs) {
          const key = pairOpponentKey(playerX, playerY);
          const updated = (roundOpponentCounts.get(key) ?? 1) - 1;
          if (updated <= 0) {
            roundOpponentCounts.delete(key);
          } else {
            roundOpponentCounts.set(key, updated);
          }
        }

        for (const participant of participants) {
          const usage = ensureCourtUsage(participant);
          const updated = (usage.get(courtNumber) ?? 1) - 1;
          if (updated <= 0) {
            usage.delete(courtNumber);
          } else {
            usage.set(courtNumber, updated);
          }
        }
      }

      used[firstIndex] = false;
    }

    explore([], 0);

    const games: Game[] = [];
    for (let index = 0; index < bestGames.list.length; index++) {
      const match = bestGames.list[index];
      const team1 = teams[match.a];
      const team2 = teams[match.b];
      const courtNumber = index + 1;
      const roundNumber = roundIndex + 1;

      const team1SkillSum = (skillMap.get(team1[0]) ?? 0) + (skillMap.get(team1[1]) ?? 0);
      const team2SkillSum = (skillMap.get(team2[0]) ?? 0) + (skillMap.get(team2[1]) ?? 0);
      const team1Average = team1SkillSum / 2;
      const team2Average = team2SkillSum / 2;

      const game: Game = {
        id: `game-${roundNumber}-${courtNumber}`,
        round: roundNumber,
        court: courtNumber,
        team1: [team1[0], team1[1]],
        team2: [team2[0], team2[1]],
        team1SkillLevel: team1SkillSum,
        team2SkillLevel: team2SkillSum,
        skillDifference: Math.abs(team1Average - team2Average)
      };

      games.push(game);

      const crossPairs: Array<[string, string]> = [
        [team1[0], team2[0]],
        [team1[0], team2[1]],
        [team1[1], team2[0]],
        [team1[1], team2[1]]
      ];

      for (const [playerX, playerY] of crossPairs) {
        const key = playerX < playerY ? `${playerX}|${playerY}` : `${playerY}|${playerX}`;
        context.opponentCounts.set(key, (context.opponentCounts.get(key) ?? 0) + 1);
      }

      const participants = [team1[0], team1[1], team2[0], team2[1]];
      for (const participant of participants) {
        if (!context.courtUsage.has(participant)) {
          context.courtUsage.set(participant, new Map<number, number>());
        }
        const usage = context.courtUsage.get(participant)!;
        usage.set(courtNumber, (usage.get(courtNumber) ?? 0) + 1);
      }
    }

    return games;
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
}
