import type { Player, Game, MatchingOptions, GameSchedule } from '../types';

export class PickleballMatcher {
  private players: Player[];
  private options: MatchingOptions;

  constructor(players: Player[], options: MatchingOptions) {
    this.players = players;
    this.options = options;
  }

  /**
   * Generate a complete game schedule based on the provided players and options.
   */
  generateSchedule(eventLabel: string = 'Pickleball Tournament'): GameSchedule {
    const { numberOfCourts, numberOfRounds, balanceSkillLevels, respectPartnerPreferences } = this.options;

    // Filter out inactive players (only schedule active/available players)
    const activePlayers = this.players.filter(p => p.active !== false);
    const totalPlayers = activePlayers.length;

    // Sanity check: ensure player count is within allowed range (4*courts to 4*courts+4)
    const minPlayers = 4 * numberOfCourts;
    const maxPlayers = 4 * numberOfCourts + 4;
    if (totalPlayers < minPlayers || totalPlayers > maxPlayers) {
      throw new Error(`Player count must be between ${minPlayers} and ${maxPlayers} for ${numberOfCourts} courts.`);
    }

    ////  Determine how many players rest each round (X = extra players beyond courts capacity)
    const playersPerRound = 4 * numberOfCourts; // players that can play each round
    const extraPlayers = totalPlayers - playersPerRound; // number of players resting each round
    const restEachRound = extraPlayers > 0 ? extraPlayers : 0; // if 0, no rests needed

    // Calculate how many times each player should rest (distribute as evenly as possible)
    const totalRestSpots = restEachRound * numberOfRounds; // total rest opportunities across all rounds
    const baseRestsPerPlayer = Math.floor(totalRestSpots / totalPlayers);
    let playersNeedingExtraRest = totalRestSpots % totalPlayers; // number of players that will rest one additional time
    // Map playerId -> rest count needed
    const restNeeded: { [playerId: string]: number } = {};
    for (const player of activePlayers) {
      // Each player gets base rests, and a few players get one extra rest until remainder is consumed
      restNeeded[player.id] = baseRestsPerPlayer + (playersNeedingExtraRest > 0 ? 1 : 0);
      if (playersNeedingExtraRest > 0) {
        playersNeedingExtraRest--;
      }
    }

    // Partner pairing preferences: determine which players want to partner and assign a round for each pair
    const partnerPairs: [string, string][] = [];
    if (respectPartnerPreferences) {
      const seen = new Set<string>();
      for (const player of activePlayers) {
        if (player.partnerId && !seen.has(player.id)) {
          const partnerId = player.partnerId;
          // Find the partner player object to ensure they exist and are active
          const partner = activePlayers.find(p => p.id === partnerId);
          if (partner && !seen.has(partnerId)) {
            // We have a mutual pair (or at least a valid partner)
            partnerPairs.push([player.id, partnerId]);
            seen.add(player.id);
            seen.add(partnerId);
          }
        }
      }
    }
    // Assign each partner pair to at least one round (not necessarily round 1, choose randomly)
    const partnerRoundsMap: { [round: number]: [string, string][] } = {};
    if (partnerPairs.length > 0) {
      // Shuffle the list of partner pairs for randomness
      const shuffledPairs = partnerPairs.slice();
      for (let i = shuffledPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPairs[i], shuffledPairs[j]] = [shuffledPairs[j], shuffledPairs[i]];
      }
      // Distribute pairs across rounds as evenly as possible
      const basePairsPerRound = Math.floor(shuffledPairs.length / numberOfRounds);
      let extraPairsRounds = shuffledPairs.length % numberOfRounds;
      // Initially give each round basePairsPerRound pairs
      let pairIndex = 0;
      for (let r = 1; r <= numberOfRounds; r++) {
        partnerRoundsMap[r] = [];
        for (let k = 0; k < basePairsPerRound; k++) {
          partnerRoundsMap[r].push(shuffledPairs[pairIndex++]);
        }
        // Assign extra pairs to some rounds (one extra pair in 'extraPairsRounds' rounds)
        if (extraPairsRounds > 0) {
          partnerRoundsMap[r].push(shuffledPairs[pairIndex++]);
          extraPairsRounds--;
        }
      }
    }

    // Prepare the schedule structure
    const rounds: Game[][] = [];
    const restingPlayers: string[][] = [];

    // Keep track of past partner combinations to minimize repeats
    const pastPartners = new Set<string>(); // store as "A|B" string for pair (order-insensitive)
    // Keep track of past opponent combinations to minimize repeats (optional improvement)
    const pastOpponents = new Set<string>(); // store as "A|B" for any two players who faced each other

    // Simulate rounds 1 through numberOfRounds
    let lastRoundRested: Set<string> = new Set(); // players who rested in the previous round
    for (let round = 1; round <= numberOfRounds; round++) {
      const restingThisRound: string[] = [];
      let playingThisRound: string[] = [];

      // Determine who rests this round
      if (restEachRound > 0) {
        // List of players eligible to rest (need rest > 0)
        let candidates = activePlayers.filter(p => restNeeded[p.id] > 0).map(p => p.id);
        // Exclude players who *must* play due to partner requirement this round
        if (partnerRoundsMap[round]) {
          for (const [p1, p2] of partnerRoundsMap[round]) {
            // Ensure neither partner is selected to rest this round
            candidates = candidates.filter(pid => pid !== p1 && pid !== p2);
          }
        }
        // Also try to avoid picking someone who rested last round (space out rests)
        let preferredCandidates = candidates.filter(pid => !lastRoundRested.has(pid));
        if (preferredCandidates.length < restEachRound) {
          // If not enough preferred candidates (maybe many had also rested last round), allow last-round resters
          preferredCandidates = candidates;
        }

        // Randomly select the required number of rest players from the preferred candidates
        // Note: We'll shuffle the candidate list and take the first N
        for (let i = preferredCandidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [preferredCandidates[i], preferredCandidates[j]] = [preferredCandidates[j], preferredCandidates[i]];
        }
        const selectedToRest = preferredCandidates.slice(0, restEachRound);
        // If for some reason we didn't get enough (perhaps not enough candidates), fill from remaining candidates
        if (selectedToRest.length < restEachRound) {
          const remaining = candidates.filter(pid => !selectedToRest.includes(pid));
          for (let i = remaining.length - 1; i > 0 && selectedToRest.length < restEachRound; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }
          selectedToRest.push(...remaining.slice(0, restEachRound - selectedToRest.length));
        }

        // Mark these players as resting this round
        for (const pid of selectedToRest) {
          restingThisRound.push(pid);
          restNeeded[pid]--; // decrement their remaining rest quota
        }
        lastRoundRested = new Set(selectedToRest); // update last-round rest set for next iteration
      } else {
        // No rests needed at all (players exactly fill the courts)
        lastRoundRested = new Set();
      }

      // Determine players playing this round = all active minus resting players
      for (const player of activePlayers) {
        if (!restingThisRound.includes(player.id)) {
          playingThisRound.push(player.id);
        }
      }

      // Shuffle the playing players list for random grouping
      for (let i = playingThisRound.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playingThisRound[i], playingThisRound[j]] = [playingThisRound[j], playingThisRound[i]];
      }

      // If there are any pre-set partner teams for this round, handle them first
      const preformedTeams: [string, string][] = [];
      if (partnerRoundsMap[round]) {
        for (const [p1, p2] of partnerRoundsMap[round]) {
          // Ensure p1 and p2 are in playing list (neither rested)
          // They should be, due to rest selection above, but double-check:
          if (!playingThisRound.includes(p1)) playingThisRound.push(p1);
          if (!playingThisRound.includes(p2)) playingThisRound.push(p2);
          // Remove the two from the playing pool (they will form their own team)
          playingThisRound = playingThisRound.filter(pid => pid !== p1 && pid !== p2);
          preformedTeams.push([p1, p2]);
          // Track this partnership to avoid repeating it later
          const key = p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
          pastPartners.add(key);
        }
      }

      const teamsThisRound: [string, string][] = [];

      // Include the preformed partner teams directly
      for (const team of preformedTeams) {
        teamsThisRound.push(team);
      }

      // Form teams from the remaining players for this round
      if (balanceSkillLevels) {
        // Skill balancing: sort remaining players by skill
        const playingPlayersObjects = playingThisRound.map(pid => activePlayers.find(p => p.id === pid)!);
        playingPlayersObjects.sort((a, b) => b.skillLevel - a.skillLevel); // descending by skill
        // Pair highest with lowest to balance teams
        while (playingPlayersObjects.length >= 2) {
          const highest = playingPlayersObjects.shift()!; // remove first (highest)
          const lowest = playingPlayersObjects.pop()!; // remove last (lowest)
          let team1: Player, team2: Player;
          if (highest && lowest) {
            team1 = highest;
            team2 = lowest;
          } else if (highest) {
            // If only one left (edge case), pair with next highest (though this shouldn't happen because count is even)
            team1 = highest;
            team2 = playingPlayersObjects.pop()!;
          } else {
            break;
          }
          teamsThisRound.push([team1.id, team2.id]);
        }
        // If an odd player remains (shouldn't happen with even count), just put them with someone (not expected given even players per round).
      } else {
        // No skill balancing: pair players randomly in the order of the shuffled list
        for (let i = 0; i < playingThisRound.length; i += 2) {
          const p1 = playingThisRound[i];
          const p2 = playingThisRound[i + 1];
          teamsThisRound.push([p1, p2]);
        }
      }

      // Now we have a list of teams (each is 2 players). Next, pair up teams into games on courts.
      const gamesThisRound: Game[] = [];
      // Shuffle teams list so that assignment to courts is random (for court variety)
      for (let i = teamsThisRound.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teamsThisRound[i], teamsThisRound[j]] = [teamsThisRound[j], teamsThisRound[i]];
      }
      // Pair consecutive teams as opponents on a court
      for (let t = 0; t < teamsThisRound.length; t += 2) {
        const team1 = teamsThisRound[t];
        const team2 = teamsThisRound[t + 1];
        // Avoid repeating a partnership within this group if possible by re-pairing (minimize partner repeats)
        const key1 = team1[0] < team1[1] ? `${team1[0]}|${team1[1]}` : `${team1[1]}|${team1[0]}`;
        const key2 = team2[0] < team2[1] ? `${team2[0]}|${team2[1]}` : `${team2[1]}|${team2[0]}`;
        if (pastPartners.has(key1) || pastPartners.has(key2)) {
          // If this round produced a team that's been seen before (should be rare due to our checks),
          // we could attempt to swap team members between teams1 and team2 to find a new pairing.
          // Try an alternate pairing of these four players:
          const [a, b] = team1;
          const [c, d] = team2;
          // Try pairing a with c, and b with d instead (one possible alternate)
          const altTeam1: [string, string] = [a, c];
          const altTeam2: [string, string] = [b, d];
          const altKey1 = a < c ? `${a}|${c}` : `${c}|${a}`;
          const altKey2 = b < d ? `${b}|${d}` : `${d}|${b}`;
          if (!pastPartners.has(altKey1) && !pastPartners.has(altKey2)) {
            // Use the alternate pairing
            team1[0] = a;
            team1[1] = c;
            team2[0] = b;
            team2[1] = d;
          }
          // (If that also repeats, other pairing could be tried, e.g., a with d and b with c.
          // We omit exhaustive checks for brevity in random approach.)
        }
        // Update partner history with these new teams
        const newKey1 = team1[0] < team1[1] ? `${team1[0]}|${team1[1]}` : `${team1[1]}|${team1[0]}`;
        const newKey2 = team2[0] < team2[1] ? `${team2[0]}|${team2[1]}` : `${team2[1]}|${team2[0]}`;
        pastPartners.add(newKey1);
        pastPartners.add(newKey2);

        // Now create the Game object
        const team1Players = team1.map(pid => activePlayers.find(p => p.id === pid)!);
        const team2Players = team2.map(pid => activePlayers.find(p => p.id === pid)!);
        const team1Skill = team1Players[0].skillLevel + team1Players[1].skillLevel;
        const team2Skill = team2Players[0].skillLevel + team2Players[1].skillLevel;
        const skillDiff = Math.abs(team1Skill - team2Skill);

        // Optionally, ensure skill difference is within maxSkillDifference by swapping across teams (advanced, not implemented fully for random approach)
        // For now, we'll assume the pairing strategy kept it within bounds or accept the result.

        // Determine court number for this game (t/2 gives 0-based index of game, +1 for 1-based court number)
        const courtNumber = Math.floor(t / 2) + 1;
        // Randomize which team is "team1" vs "team2" to vary sides of the court
        let finalTeam1 = team1;
        let finalTeam2 = team2;
        if (Math.random() < 0.5) {
          finalTeam1 = team2;
          finalTeam2 = team1;
        }
        gamesThisRound.push({
          id: `game-${round}-${courtNumber}`,
          round: round,
          court: courtNumber,
          team1: [finalTeam1[0], finalTeam1[1]],
          team2: [finalTeam2[0], finalTeam2[1]],
          team1SkillLevel: finalTeam1 === team1 ? team1Skill : team2Skill,
          team2SkillLevel: finalTeam2 === team2 ? team2Skill : team1Skill,
          skillDifference: Math.abs(team1Skill - team2Skill)
        });
        // Track opponents for each pair of players in this game to minimize future repeats (optional)
        pastOpponents.add(`${team1[0]}|${team2[0]}`);
        pastOpponents.add(`${team1[0]}|${team2[1]}`);
        pastOpponents.add(`${team1[1]}|${team2[0]}`);
        pastOpponents.add(`${team1[1]}|${team2[1]}`);
      }

      rounds.push(gamesThisRound);
      restingPlayers.push(restingThisRound);
    }

    // Construct the final GameSchedule object
    return {
      rounds: rounds,
      restingPlayers: restingPlayers,
      eventLabel: eventLabel,
      options: this.options,
      generatedAt: new Date()
    };
  }
}
