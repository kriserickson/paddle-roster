const PAIR_SIZE = 2;
const REST_SEARCH_NODE_LIMIT = 2048;
const FOUR_ELEMENT_FIELD_SIZE = 4;
const FOUR_ELEMENT_FIELD_MODULUS = 0b111;
const FIVE_GROUPS = 5;
const REST_IMPROVEMENT_LIMIT = 20;

interface RestGroup {
  pairs: number[];
  players: number[];
}

const groupCache = new Map<string, RestGroup[]>();

function improveRestSpacing(plan: string[][], firstRoundSitters: string[]): string[][] {
  const ids = [...new Set(plan.flat())];
  const playerCount = ids.length;
  const rounds = plan.map(round => round.map(id => ids.indexOf(id)));
  const fixedFirst = new Set(firstRoundSitters.map(id => ids.indexOf(id)));
  const pairCounts = Array.from({ length: playerCount * playerCount }, () => 0);
  const rests: number[][] = Array.from({ length: playerCount }, () => []);
  const pairIndex = (a: number, b: number): number => Math.min(a, b) * playerCount + Math.max(a, b);
  const repeatCost = (count: number): number => (count * (count - 1)) / PAIR_SIZE;
  const spacingCost = (restRounds: number[]): [number, number] => {
    let adjacent = 0;
    let cost = 0;
    for (let index = 1; index < restRounds.length; index += 1) {
      const gap = restRounds[index]! - restRounds[index - 1]!;
      if (gap === 1) adjacent += 1;
      cost += (plan.length / gap) ** PAIR_SIZE;
    }
    return [adjacent, cost];
  };
  rounds.forEach((resting, round) => {
    resting.forEach((first, index) => {
      rests[first]!.push(round);
      for (const second of resting.slice(index + 1)) pairCounts[pairIndex(first, second)]! += 1;
    });
  });

  // Swapping rests preserves every player's quota and the size of each resting block.
  for (let pass = 0; pass < REST_IMPROVEMENT_LIMIT; pass += 1) {
    let bestRepeats = 0;
    let bestAdjacent = 0;
    let bestSpacing = 0;
    let applyBest: (() => void) | undefined;
    for (let firstRound = 0; firstRound < rounds.length; firstRound += 1) {
      const firstGroup = rounds[firstRound]!;
      for (let secondRound = firstRound + 1; secondRound < rounds.length; secondRound += 1) {
        const secondGroup = rounds[secondRound]!;
        firstGroup.forEach((first, firstPosition) => {
          if ((firstRound === 0 && fixedFirst.has(first)) || secondGroup.includes(first)) return;
          secondGroup.forEach((second, secondPosition) => {
            if (firstGroup.includes(second)) return;
            const changes = new Map<number, number>();
            const changePair = (a: number, b: number, change: number): void => {
              const pair = pairIndex(a, b);
              changes.set(pair, (changes.get(pair) || 0) + change);
            };
            for (const other of firstGroup) {
              if (other !== first) {
                changePair(first, other, -1);
                changePair(second, other, 1);
              }
            }
            for (const other of secondGroup) {
              if (other !== second) {
                changePair(second, other, -1);
                changePair(first, other, 1);
              }
            }
            let repeatDelta = 0;
            for (const [pair, change] of changes) {
              repeatDelta += repeatCost(pairCounts[pair]! + change) - repeatCost(pairCounts[pair]!);
            }
            if (repeatDelta > bestRepeats) return;
            const firstRests = rests[first]!.map(round => (round === firstRound ? secondRound : round)).sort(
              (a, b) => a - b
            );
            const secondRests = rests[second]!.map(round => (round === secondRound ? firstRound : round)).sort(
              (a, b) => a - b
            );
            const beforeFirst = spacingCost(rests[first]!);
            const beforeSecond = spacingCost(rests[second]!);
            const afterFirst = spacingCost(firstRests);
            const afterSecond = spacingCost(secondRests);
            const adjacentDelta = afterFirst[0] + afterSecond[0] - beforeFirst[0] - beforeSecond[0];
            const spacingDelta = afterFirst[1] + afterSecond[1] - beforeFirst[1] - beforeSecond[1];
            if (
              repeatDelta === bestRepeats &&
              (adjacentDelta > bestAdjacent ||
                (adjacentDelta === bestAdjacent && spacingDelta >= bestSpacing - Number.EPSILON))
            )
              return;
            bestRepeats = repeatDelta;
            bestAdjacent = adjacentDelta;
            bestSpacing = spacingDelta;
            applyBest = (): void => {
              firstGroup[firstPosition] = second;
              secondGroup[secondPosition] = first;
              rests[first] = firstRests;
              rests[second] = secondRests;
              for (const [pair, change] of changes) pairCounts[pair]! += change;
            };
          });
        });
      }
    }
    if (!applyBest) break;
    applyBest();
  }
  return rounds.map(round => round.map(player => ids[player]!));
}

function multiplyFourElementField(first: number, second: number): number {
  let product = 0;
  let left = first;
  let right = second;
  while (right > 0) {
    if (right & 1) product ^= left;
    right >>= 1;
    left <<= 1;
    if (left & FOUR_ELEMENT_FIELD_SIZE) left ^= FOUR_ELEMENT_FIELD_MODULUS;
  }
  return product;
}

function createPartitionPlan(playerIds: string[], sitters: number, rounds: number): string[][] | undefined {
  const groupCount = playerIds.length / sitters;
  if (!Number.isInteger(groupCount)) return undefined;
  if (sitters === PAIR_SIZE) {
    // Each pass uses everyone once; rotating the ring gives every pair a different partner.
    const ring = [playerIds[0]!, ...playerIds.slice(PAIR_SIZE), playerIds[1]!];
    const plan: string[][] = [];
    while (plan.length < rounds) {
      for (let group = 0; group < groupCount && plan.length < rounds; group += 1) {
        plan.push([ring[group]!, ring[ring.length - 1 - group]!]);
      }
      ring.splice(1, 0, ring.pop()!);
    }
    return plan;
  }
  if (groupCount !== FIVE_GROUPS && !(groupCount === FOUR_ELEMENT_FIELD_SIZE && sitters === FOUR_ELEMENT_FIELD_SIZE)) {
    return undefined;
  }
  // Offset each position differently between passes, so groups split up on the next pass.
  // Four groups use field multiplication to keep every pair distinct, as with five prime-sized groups.
  return Array.from({ length: rounds }, (_, round) => {
    const pass = Math.floor(round / groupCount) % groupCount;
    const group = round % groupCount;
    return Array.from({ length: sitters }, (__, position) => {
      const sourceGroup =
        groupCount === FOUR_ELEMENT_FIELD_SIZE
          ? group ^ multiplyFourElementField(pass, position)
          : (group + pass * position) % groupCount;
      return playerIds[sourceGroup * sitters + position]!;
    });
  });
}

function getGroups(playerCount: number, groupSize: number): RestGroup[] {
  const key = `${playerCount}:${groupSize}`;
  const cached = groupCache.get(key);
  if (cached) return cached;
  const groups: RestGroup[] = [];
  const choose = (players: number[], start: number): void => {
    if (players.length === groupSize) {
      const pairs: number[] = [];
      players.forEach((first, index) => {
        for (const second of players.slice(index + 1)) pairs.push(first * playerCount + second);
      });
      groups.push({ pairs, players });
      return;
    }
    for (let player = start; player <= playerCount - (groupSize - players.length); player += 1) {
      choose([...players, player], player + 1);
    }
  };
  choose([], 0);
  groupCache.set(key, groups);
  return groups;
}

/** Allocate exact floor/ceiling rest quotas, then vary who rests together. Player order breaks ties. */
export function createBalancedRestPlan(
  playerIds: string[],
  sittersPerRound: number,
  numberOfRounds: number,
  firstRoundSitters: readonly string[] = []
): string[][] {
  if (sittersPerRound <= 0 || playerIds.length === 0 || numberOfRounds === 0) {
    return Array.from({ length: numberOfRounds }, () => []);
  }

  const playerCount = playerIds.length;
  const requiredFirst = [...new Set(firstRoundSitters)]
    .map(id => playerIds.indexOf(id))
    .filter(index => index >= 0)
    .slice(0, sittersPerRound);
  const firstIds = requiredFirst.map(index => playerIds[index]!);
  const orderedIds = [...firstIds, ...playerIds.filter(id => !firstIds.includes(id))];
  const partitionPlan = createPartitionPlan(orderedIds, sittersPerRound, numberOfRounds);
  if (partitionPlan) return sittersPerRound === PAIR_SIZE ? partitionPlan : improveRestSpacing(partitionPlan, firstIds);
  const slots = sittersPerRound * numberOfRounds;
  const minimum = Math.floor(slots / playerCount);
  const extra = slots % playerCount;
  const quotaOrder = Array.from({ length: playerCount }, (_, index) => index);
  // When there are fewer rest slots than players, all requested first-round sitters need a slot.
  if (minimum === 0) quotaOrder.sort((a, b) => Number(requiredFirst.includes(b)) - Number(requiredFirst.includes(a)));
  const remaining = Array.from({ length: playerCount }, () => minimum);
  quotaOrder.slice(0, extra).forEach(player => {
    remaining[player]! += 1;
  });
  const pairCounts = Array.from({ length: playerCount * playerCount }, () => 0);
  const restRounds: number[][] = Array.from({ length: playerCount }, () => []);
  const plan: number[][] = [];
  const groups = getGroups(playerCount, sittersPerRound);

  const candidates = (round: number, avoidRepeats: boolean): RestGroup[] => {
    const roundsLeft = numberOfRounds - round;
    const required = remaining.flatMap((quota, player) => (quota === roundsLeft ? [player] : []));
    if (round === 0) required.push(...requiredFirst);
    return groups
      .filter(
        group =>
          group.players.every(player => remaining[player]! > 0) &&
          required.every(player => group.players.includes(player)) &&
          (!avoidRepeats || group.pairs.every(pair => pairCounts[pair] === 0))
      )
      .map(group => ({
        group,
        repeats: group.pairs.reduce((sum, pair) => sum + pairCounts[pair]!, 0),
        spacing: group.players.reduce((sum, player) => {
          const last = restRounds[player]!.at(-1);
          return sum + (last === undefined ? 0 : (numberOfRounds / (round - last)) ** PAIR_SIZE);
        }, 0),
        urgency: group.players.reduce((sum, player) => sum + remaining[player]!, 0)
      }))
      .sort((a, b) => a.repeats - b.repeats || a.spacing - b.spacing || b.urgency - a.urgency)
      .map(candidate => candidate.group);
  };

  const assign = (group: RestGroup, round: number, direction: 1 | -1): void => {
    for (const player of group.players) {
      remaining[player]! -= direction;
      if (direction === 1) restRounds[player]!.push(round);
      else restRounds[player]!.pop();
    }
    for (const pair of group.pairs) pairCounts[pair]! += direction;
    if (direction === 1) plan.push([...group.players]);
    else plan.pop();
  };

  let nodesLeft = REST_SEARCH_NODE_LIMIT;
  const search = (round: number): boolean => {
    if (round === numberOfRounds) return true;
    if (nodesLeft <= 0) return false;
    nodesLeft -= 1;
    for (let player = 0; player < playerCount; player += 1) {
      const availablePartners = remaining.filter(
        (quota, other) =>
          quota > 0 &&
          other !== player &&
          pairCounts[Math.min(player, other) * playerCount + Math.max(player, other)] === 0
      ).length;
      if (remaining[player]! * (sittersPerRound - 1) > availablePartners) return false;
    }
    for (const group of candidates(round, true)) {
      assign(group, round, 1);
      if (search(round + 1)) return true;
      assign(group, round, -1);
      if (nodesLeft <= 0) break;
    }
    return false;
  };

  const distinctPairsPossible = remaining.every(quota => quota * (sittersPerRound - 1) <= playerCount - 1);
  if (!distinctPairsPossible || !search(0)) {
    // Every step includes anyone who must rest now to finish their quota. This
    // preserves exact totals even when repeating some rest partners is unavoidable.
    for (let round = 0; round < numberOfRounds; round += 1) {
      const group = candidates(round, false)[0];
      if (!group) throw new Error('Could not allocate balanced rest periods');
      assign(group, round, 1);
    }
  }
  return improveRestSpacing(
    plan.map(round => round.map(player => playerIds[player]!)),
    firstIds
  );
}
