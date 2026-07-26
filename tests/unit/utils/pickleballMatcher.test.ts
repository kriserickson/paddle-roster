const PAIR_SIZE = 2;
const SIX_ROUND_COUNT = 6;
const DEFAULT_COURT_COUNT = 3;
const THREE_ROUND_COUNT = 3;
const MAX_AVOIDABLE_OPPONENT_PAIRS_TWO = 2;
const MAX_AVOIDABLE_OPPONENT_PAIRS_THREE = 3;
const MAX_AVOIDABLE_OPPONENT_PAIRS_FOUR = 4;
const MAX_PARTNERSHIP_REPEAT_COUNT = 2;
const EIGHT_PLAYER_COUNT = 8;
const EIGHT_ROUND_COUNT = 8;
const MAX_AVOIDABLE_OPPONENT_PAIRS_EIGHT = 8;
const TEN_PLAYER_COUNT = 10;
const TEN_ROUND_COUNT = 10;
const TWELVE_PLAYER_COUNT = 12;
const TWELVE_ROUND_COUNT = 12;
const MAX_AVOIDABLE_OPPONENT_PAIRS_TWELVE = 12;
const PLAYERS_PER_GAME = 4;
const SEVEN_ROUND_COUNT = 7;
const MAX_AVOIDABLE_OPPONENT_PAIRS_SEVEN = 7;
const PARTNER_REPEAT_SCORE_WEIGHT = 2500;
const OPPONENT_REPEAT_SCORE_WEIGHT = 320;
const NINE_ROUND_COUNT = 9;

import { describe, expect, it } from 'vitest';
import type { Game, GameSchedule, MatchingOptions, Player } from '../../../types';
import { PickleballMatcher } from '../../../utils/pickleballMatcher';

/**
 * Helper function to validate all games have exactly 4 players
 */
function validateAllGamesHavePlayers(schedule: GameSchedule): void {
  schedule.rounds.forEach((round: Game[], roundIndex: number) => {
    round.forEach((game: Game, gameIndex: number) => {
      expect(game.team1, `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team1 should have 2 players`).toHaveLength(
        PAIR_SIZE
      );
      expect(game.team2, `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team2 should have 2 players`).toHaveLength(
        PAIR_SIZE
      );
      expect(game.team1[0], `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team1[0] should be defined`).toBeDefined();
      expect(game.team1[1], `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team1[1] should be defined`).toBeDefined();
      expect(game.team2[0], `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team2[0] should be defined`).toBeDefined();
      expect(game.team2[1], `Round ${roundIndex + 1}, Game ${gameIndex + 1}: team2[1] should be defined`).toBeDefined();
    });
  });
}

describe('PickleballMatcher', () => {
  // Create test players with various skill levels (16 players total)
  const players: Player[] = [
    { id: '1', name: 'Alice', partnerId: '2', skillLevel: 2.75 },
    { id: '2', name: 'Bob', partnerId: '1', skillLevel: 3.25 },
    { id: '3', name: 'Charlie', partnerId: '4', skillLevel: 3.0 },
    { id: '4', name: 'Diana', partnerId: '3', skillLevel: 3.25 },
    { id: '5', name: 'Eve', partnerId: undefined, skillLevel: 3.5 },
    { id: '6', name: 'Frank', partnerId: undefined, skillLevel: 3.25 },
    { id: '7', name: 'Grace', partnerId: '8', skillLevel: 3.0 },
    { id: '8', name: 'Henry', partnerId: '7', skillLevel: 2.75 },
    { id: '9', name: 'Ivy', partnerId: undefined, skillLevel: 3.5 },
    { id: '10', name: 'Jack', partnerId: undefined, skillLevel: 3.75 },
    { id: '11', name: 'Kate', partnerId: undefined, skillLevel: 3.5 },
    { id: '12', name: 'Liam', partnerId: undefined, skillLevel: 3.0 },
    { id: '13', name: 'Mia', partnerId: undefined, skillLevel: 3.5 },
    { id: '14', name: 'Noah', partnerId: undefined, skillLevel: 3.75 },
    { id: '15', name: 'Olivia', partnerId: '16', skillLevel: 2.75 },
    { id: '16', name: 'Peter', partnerId: '15', skillLevel: 3.0 }
  ];

  const defaultOptions: MatchingOptions = {
    balanceSkillLevels: false,
    distributeRestEqually: true,
    maxSkillDifference: 1.5,
    numberOfCourts: 3,
    numberOfRounds: 8,
    respectPartnerPreferences: false
  };

  describe('constructor', () => {
    it('should initialize with players and options', async () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      expect(matcher).toBeDefined();
    });
  });

  describe('should generate a valid schedule', () => {
    describe('16 players on 3 courts', () => {
      it('should generate valid schedule for 6 rounds', async () => {
        const options = Object.assign({}, defaultOptions, {
          numberOfRounds: 6
        });
        const matcher = new PickleballMatcher(players, options);
        const schedule = await matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(SIX_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(DEFAULT_COURT_COUNT);
        expect(schedule.eventLabel).toBe('Test Event');
        expect(schedule.options).toEqual(options);
        expect(schedule.generatedAt).toBeInstanceOf(Date);
        validateAllGamesHavePlayers(schedule);
      });

      it('should generate valid schedule for 8 rounds', async () => {
        const matcher = new PickleballMatcher(players, defaultOptions);
        const schedule = await matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(EIGHT_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(DEFAULT_COURT_COUNT);
        expect(schedule.eventLabel).toBe('Test Event');
        expect(schedule.options).toEqual(defaultOptions);
        expect(schedule.generatedAt).toBeInstanceOf(Date);
      });

      it('should generate valid schedule for 10 rounds', async () => {
        const options = Object.assign({}, defaultOptions, {
          numberOfRounds: 10
        });
        const matcher = new PickleballMatcher(players, options);
        const schedule = await matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(TEN_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(DEFAULT_COURT_COUNT);
      });

      it('should generate valid schedule for 12 rounds', async () => {
        const options = Object.assign({}, defaultOptions, {
          numberOfRounds: 12
        });
        const matcher = new PickleballMatcher(players, options);
        const schedule = await matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(TWELVE_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(DEFAULT_COURT_COUNT);
      });
    });
    describe('12 players on 2 courts', () => {
      it('should generate valid schedule for 6 rounds', async () => {
        const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 6
        });
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(SIX_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
        // 12 players, 8 playing per round (2 courts * 4 players), 4 resting
        schedule.rounds.forEach((round: Game[], index: number) => {
          expect(round.length).toBe(PAIR_SIZE);
          expect(schedule.restingPlayers[index]).toHaveLength(PLAYERS_PER_GAME);
          // Ensure every game has 4 players
          round.forEach((game: Game) => {
            expect(game.team1).toHaveLength(PAIR_SIZE);
            expect(game.team2).toHaveLength(PAIR_SIZE);
            expect(game.team1[0]).toBeDefined();
            expect(game.team1[1]).toBeDefined();
            expect(game.team2[0]).toBeDefined();
            expect(game.team2[1]).toBeDefined();
          });
        });
      });

      it('should generate valid schedule for 8 rounds', async () => {
        const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 8
        });
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(EIGHT_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });

      it('should generate valid schedule for 10 rounds', async () => {
        const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 10
        });
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(TEN_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });

      it('should generate valid schedule for 12 rounds', async () => {
        const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 12
        });
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(TWELVE_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });
    });

    describe('10 players on 2 courts', () => {
      it('should generate valid schedule for 6 rounds', async () => {
        const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 6
        });
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(SIX_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
        // 10 players, 8 playing per round (2 courts * 4 players), 2 resting
        schedule.rounds.forEach((round: Game[], index: number) => {
          expect(round.length).toBe(PAIR_SIZE);
          expect(schedule.restingPlayers[index]).toHaveLength(PAIR_SIZE);
          // Ensure every game has 4 players
          round.forEach((game: Game) => {
            expect(game.team1).toHaveLength(PAIR_SIZE);
            expect(game.team2).toHaveLength(PAIR_SIZE);
            expect(game.team1[0]).toBeDefined();
            expect(game.team1[1]).toBeDefined();
            expect(game.team2[0]).toBeDefined();
            expect(game.team2[1]).toBeDefined();
          });
        });
      });

      it('should generate valid schedule for 8 rounds', async () => {
        const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 8
        });
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(EIGHT_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });

      it('should generate valid schedule for 10 rounds', async () => {
        const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 10
        });
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(TEN_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });

      it('should generate valid schedule for 12 rounds', async () => {
        const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
        const options = Object.assign({}, defaultOptions, {
          numberOfCourts: 2,
          numberOfRounds: 12
        });
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = await matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(TWELVE_ROUND_COUNT);
        expect(schedule.rounds[0]).toHaveLength(PAIR_SIZE);
      });
    });
  });

  describe('should ensure no players play together more than once', () => {
    function testPartnerships(
      testPlayers: Player[],
      testOptions: MatchingOptions,
      repeats: number,
      maxNumber: number,
      testName: string
    ): void {
      it(`should prevent repeated partnerships - ${testName}`, async () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = await matcher.generateSchedule();

        // Track partnerships across all rounds
        const partnerships = new Map<string, number>();

        schedule.rounds.forEach((round: Game[]) => {
          round.forEach((game: Game) => {
            // Team 1 partnerships
            const team1Key = [game.team1[0], game.team1[1]].sort().join('-');
            partnerships.set(team1Key, (partnerships.get(team1Key) || 0) + 1);

            // Team 2 partnerships
            const team2Key = [game.team2[0], game.team2[1]].sort().join('-');
            partnerships.set(team2Key, (partnerships.get(team2Key) || 0) + 1);
          });
        });

        let overCount = 0;
        // No partnership should occur more than once
        partnerships.forEach(count => {
          if (count > repeats) {
            overCount += 1;
          }
        });
        expect(
          overCount,
          `There where ${overCount} times the partnership was count was greater than ${repeats}`
        ).toBeLessThanOrEqual(maxNumber);
      });
    }

    describe('16 players on 3 courts', () => {
      testPartnerships(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 6
        }),
        1,
        0,
        '16 players, 3 courts, 6 rounds'
      );
      testPartnerships(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 8
        }),
        1,
        0,
        '16 players, 3 courts, 8 rounds'
      );
      testPartnerships(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 10
        }),
        1,
        1,
        '16 players, 3 courts, 10 rounds'
      );
      testPartnerships(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 12
        }),
        1,
        DEFAULT_COURT_COUNT,
        '16 players, 3 courts, 12 rounds'
      );
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testPartnerships(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        MAX_PARTNERSHIP_REPEAT_COUNT,
        0,
        '12 players, 2 courts, 6 rounds'
      );
      testPartnerships(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        PAIR_SIZE,
        0,
        '12 players, 2 courts, 8 rounds'
      );
      testPartnerships(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        PAIR_SIZE,
        0,
        '12 players, 2 courts, 10 rounds'
      );
      testPartnerships(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        PAIR_SIZE,
        0,
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testPartnerships(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        PAIR_SIZE,
        0,
        '10 players, 2 courts, 6 rounds'
      );
      testPartnerships(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        PAIR_SIZE,
        1,
        '10 players, 2 courts, 8 rounds'
      );
      testPartnerships(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        PAIR_SIZE,
        1,
        '10 players, 2 courts, 10 rounds'
      );
      testPartnerships(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        PAIR_SIZE,
        1,
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  describe('should minimize repeated opponents', () => {
    function testOpponentLimits(
      testPlayers: Player[],
      testOptions: MatchingOptions,
      maxAvoidablePairs: number,
      testName: string,
      maxEncounterSlack = 1
    ): void {
      it(`should limit opponent encounters - ${testName}`, async () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = await matcher.generateSchedule();

        // Track opponent pair counts across all games.
        const opponentPairCounts = new Map<string, number>();
        schedule.rounds.forEach((round: Game[]) => {
          round.forEach((game: Game) => {
            game.team1.forEach((p1: string) => {
              game.team2.forEach((p2: string) => {
                const key = [p1, p2].sort().join('-');
                opponentPairCounts.set(key, (opponentPairCounts.get(key) || 0) + 1);
              });
            });
          });
        });

        const counts = Array.from(opponentPairCounts.values());
        const maxEncounter = Math.max(...counts);
        const totalMatchups = counts.reduce((sum, count) => sum + count, 0);
        const totalUniquePairs = (testPlayers.length * (testPlayers.length - 1)) / PAIR_SIZE;
        const theoreticalMinMax = Math.ceil(totalMatchups / totalUniquePairs);

        // Some pairs being above 2 encounters is unavoidable when matchups exceed 2× unique pairs.
        // minimumPairsAboveTwo is the minimum number of distinct pairs that MUST exceed 2 encounters
        // (achieved by spreading forced excess one encounter per pair at count=3).
        const minimumPairsAboveTwo = Math.max(0, totalMatchups - totalUniquePairs * PAIR_SIZE);
        const pairsAboveTwo = counts.filter(count => count > PAIR_SIZE).length;
        const avoidablePairsAboveTwo = pairsAboveTwo - minimumPairsAboveTwo;

        expect(
          maxEncounter,
          `Max opponent repeats should stay close to the theoretical minimum in ${testName}`
        ).toBeLessThanOrEqual(theoreticalMinMax + maxEncounterSlack);

        expect(
          avoidablePairsAboveTwo,
          `Avoidable pairs with 3+ encounters should stay low in ${testName}`
        ).toBeLessThanOrEqual(maxAvoidablePairs);
      });
    }

    describe('16 players on 3 courts', () => {
      testOpponentLimits(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 6
        }),
        1,
        '16 players, 3 courts, 6 rounds'
      );
      testOpponentLimits(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 8
        }),
        PAIR_SIZE,
        '16 players, 3 courts, 8 rounds'
      );
      testOpponentLimits(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 10
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_THREE,
        '16 players, 3 courts, 10 rounds'
      );
      testOpponentLimits(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 12
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_FOUR,
        '16 players, 3 courts, 12 rounds'
      );
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testOpponentLimits(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        1,
        '12 players, 2 courts, 6 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_TWO,
        '12 players, 2 courts, 8 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfCourts: 2,
          numberOfRounds: 10
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_THREE,
        '12 players, 2 courts, 10 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfCourts: 2,
          numberOfRounds: 12
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_EIGHT,
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testOpponentLimits(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_TWO,
        '10 players, 2 courts, 6 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_THREE,
        '10 players, 2 courts, 8 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_SEVEN,
        '10 players, 2 courts, 10 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        MAX_AVOIDABLE_OPPONENT_PAIRS_TWELVE,
        '10 players, 2 courts, 12 rounds',
        PAIR_SIZE
      );
    });
  });

  describe('scoring priorities', () => {
    it('should penalize partner repeats more than comparable opponent repeats', () => {
      const testPlayers = players.slice(0, EIGHT_PLAYER_COUNT);
      const options: MatchingOptions = Object.assign({}, defaultOptions, {
        balanceSkillLevels: false,
        distributeRestEqually: false,
        numberOfCourts: 2,
        numberOfRounds: 2,
        respectPartnerPreferences: false
      });
      const matcher = new PickleballMatcher(testPlayers, options);

      const skillsById = new Map(testPlayers.map(player => [player.id, player.skillLevel]));

      const createGame = (
        id: string,
        round: number,
        court: number,
        team1: [string, string],
        team2: [string, string]
      ): Game => {
        const team1SkillLevel = (skillsById.get(team1[0]) || 0) + (skillsById.get(team1[1]) || 0);
        const team2SkillLevel = (skillsById.get(team2[0]) || 0) + (skillsById.get(team2[1]) || 0);
        return {
          court,
          id,
          round,
          skillDifference: Math.abs(team1SkillLevel - team2SkillLevel),
          team1,
          team1SkillLevel,
          team2,
          team2SkillLevel
        };
      };

      const partnerRepeatSchedule: GameSchedule = {
        eventLabel: 'Partner Repeat',
        generatedAt: new Date(),
        options,
        restingPlayers: [[], []],
        rounds: [
          [
            createGame('g-1-1', 1, 1, ['1', '2'], ['3', '4']),
            createGame('g-1-2', 1, PAIR_SIZE, ['5', '6'], ['7', '8'])
          ],
          [
            createGame('g-2-1', PAIR_SIZE, 1, ['1', '2'], ['5', '7']),
            createGame('g-2-2', PAIR_SIZE, PAIR_SIZE, ['3', '4'], ['6', '8'])
          ]
        ]
      };

      const opponentRepeatSchedule: GameSchedule = {
        eventLabel: 'Opponent Repeat',
        generatedAt: new Date(),
        options,
        restingPlayers: [[], []],
        rounds: [
          [
            createGame('g-1-1', 1, 1, ['1', '2'], ['3', '4']),
            createGame('g-1-2', 1, PAIR_SIZE, ['5', '6'], ['7', '8'])
          ],
          [
            createGame('g-2-1', PAIR_SIZE, 1, ['1', '5'], ['2', '3']),
            createGame('g-2-2', PAIR_SIZE, PAIR_SIZE, ['4', '7'], ['6', '8'])
          ]
        ]
      };

      const partnerPenalty =
        (matcher as unknown as { scorePartnerRepeats: (s: GameSchedule) => number }).scorePartnerRepeats(
          partnerRepeatSchedule
        ) * PARTNER_REPEAT_SCORE_WEIGHT;
      const opponentPenalty =
        (matcher as unknown as { scoreOpponentRepeats: (s: GameSchedule) => number }).scoreOpponentRepeats(
          opponentRepeatSchedule
        ) * OPPONENT_REPEAT_SCORE_WEIGHT;

      expect(partnerPenalty).toBeGreaterThan(opponentPenalty);
    });
  });

  describe('should ensure proper rest distribution', () => {
    function testRestDistribution(testPlayers: Player[], testOptions: MatchingOptions, testName: string): void {
      it(`should distribute rest periods properly - ${testName}`, async () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = await matcher.generateSchedule();

        const totalPlayers = testPlayers.length;
        const playersPerRound = testOptions.numberOfCourts * PLAYERS_PER_GAME;
        const expectedRestingPerRound = Math.max(0, totalPlayers - playersPerRound);

        if (expectedRestingPerRound > 0) {
          // Track rest periods for each player
          const playerRestRounds = new Map<string, number[]>();

          testPlayers.forEach(player => {
            playerRestRounds.set(player.id, []);
          });

          schedule.rounds.forEach((round: Game[], roundIndex: number) => {
            const playingPlayerIds = new Set<string>();
            round.forEach((game: Game) => {
              playingPlayerIds.add(game.team1[0]);
              playingPlayerIds.add(game.team1[1]);
              playingPlayerIds.add(game.team2[0]);
              playingPlayerIds.add(game.team2[1]);
            });

            testPlayers.forEach(player => {
              if (!playingPlayerIds.has(player.id)) {
                const restRounds = playerRestRounds.get(player.id);
                if (restRounds) {
                  restRounds.push(roundIndex);
                }
              }
            });
          });

          // Each round should have the expected number of resting players
          schedule.restingPlayers.forEach((restingPlayersInRound: string[], roundIndex: number) => {
            expect(
              restingPlayersInRound.length,
              `Round ${roundIndex + 1} should have ${expectedRestingPerRound} resting players in ${testName}`
            ).toBe(expectedRestingPerRound);
          });

          // For longer schedules, check rest period spacing
          if (testOptions.numberOfRounds >= EIGHT_ROUND_COUNT) {
            playerRestRounds.forEach((restRounds, playerId) => {
              if (restRounds.length >= PAIR_SIZE) {
                const diff = Math.abs(restRounds[1] - restRounds[0]);
                expect(
                  diff,
                  `Player ${playerId} rest periods too close together in ${testName}`
                ).toBeGreaterThanOrEqual(PAIR_SIZE);
              }
            });
          }
        }
      });
    }

    describe('16 players on 3 courts', () => {
      testRestDistribution(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 6
        }),
        '16 players, 3 courts, 6 rounds'
      );
      testRestDistribution(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 8
        }),
        '16 players, 3 courts, 8 rounds'
      );
      testRestDistribution(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 10
        }),
        '16 players, 3 courts, 10 rounds'
      );
      testRestDistribution(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 12
        }),
        '16 players, 3 courts, 12 rounds'
      );
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testRestDistribution(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        '12 players, 2 courts, 6 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        '12 players, 2 courts, 8 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        '12 players, 2 courts, 10 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testRestDistribution(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        '10 players, 2 courts, 6 rounds'
      );
      testRestDistribution(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        '10 players, 2 courts, 8 rounds'
      );
      testRestDistribution(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        '10 players, 2 courts, 10 rounds'
      );
      testRestDistribution(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  describe('should respect skill level differences when balancing is enabled', () => {
    function testSkillBalancing(testPlayers: Player[], testOptions: MatchingOptions, testName: string): void {
      it(`should balance skill levels - ${testName}`, async () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = await matcher.generateSchedule();

        schedule.rounds.forEach((round: Game[], roundIndex: number) => {
          round.forEach((game: Game, gameIndex: number) => {
            // Calculate team skill averages
            const team1Skills = game.team1.map((id: string) => {
              const player = testPlayers.find(p => p.id === id);
              return player ? player.skillLevel : 0;
            });
            const team2Skills = game.team2.map((id: string) => {
              const player = testPlayers.find(p => p.id === id);
              return player ? player.skillLevel : 0;
            });

            const team1Avg = team1Skills.reduce((sum: number, skill: number) => sum + skill, 0) / team1Skills.length;
            const team2Avg = team2Skills.reduce((sum: number, skill: number) => sum + skill, 0) / team2Skills.length;

            const skillDifference = Math.abs(team1Avg - team2Avg);

            // Skill difference should not exceed the configured maximum
            expect(
              skillDifference,
              `In round ${roundIndex} game ${gameIndex} the skill difference was ${skillDifference} in ${testName}`
            ).toBeLessThanOrEqual(testOptions.maxSkillDifference);
          });
        });
      });
    }

    describe('16 players on 3 courts', () => {
      testSkillBalancing(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 6
        }),
        '16 players, 3 courts, 6 rounds'
      );
      testSkillBalancing(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 8
        }),
        '16 players, 3 courts, 8 rounds'
      );
      testSkillBalancing(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 10
        }),
        '16 players, 3 courts, 10 rounds'
      );
      testSkillBalancing(
        players,
        Object.assign({}, defaultOptions, {
          numberOfRounds: 12
        }),
        '16 players, 3 courts, 12 rounds'
      );
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, TWELVE_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testSkillBalancing(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        '12 players, 2 courts, 6 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        '12 players, 2 courts, 8 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        '12 players, 2 courts, 10 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, TEN_PLAYER_COUNT);
      const options = Object.assign({}, defaultOptions, {
        numberOfCourts: 2
      });
      testSkillBalancing(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 6
        }),
        '10 players, 2 courts, 6 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 8
        }),
        '10 players, 2 courts, 8 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 10
        }),
        '10 players, 2 courts, 10 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        Object.assign({}, options, {
          numberOfRounds: 12
        }),
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  // Keep the remaining tests from the original file
  describe('partner preferences', () => {
    it('should respect partner preferences when enabled', async () => {
      const matcher = new PickleballMatcher(
        players,
        Object.assign({}, defaultOptions, {
          respectPartnerPreferences: true
        })
      );
      const schedule = await matcher.generateSchedule();

      // Track partner pairings
      const preferredPartnerPairings = new Map<string, number>();

      // Define expected partner pairs from our test data
      const expectedPairs = [
        ['1', '2'], // Alice & Bob
        ['3', '4'], // Charlie & Diana
        ['7', '8'], // Grace & Henry
        ['15', '16'] // Olivia & Peter
      ];

      schedule.rounds.forEach((round: Game[]) => {
        round.forEach((game: Game) => {
          // Check team 1
          const team1Sorted = game.team1.slice().sort();
          // Check team 2
          const team2Sorted = game.team2.slice().sort();

          expectedPairs.forEach(pair => {
            const pairKey = pair.slice().sort().join('-');
            if (team1Sorted.join('-') === pairKey || team2Sorted.join('-') === pairKey) {
              preferredPartnerPairings.set(pairKey, (preferredPartnerPairings.get(pairKey) || 0) + 1);
            }
          });
        });
      });

      // Each preferred partner pair should appear at least once
      expectedPairs.forEach(pair => {
        const pairKey = pair.slice().sort().join('-');
        expect(preferredPartnerPairings.get(pairKey) || 0).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle minimum number of players (4)', async () => {
      const minPlayers = players.slice(0, PLAYERS_PER_GAME);
      const minOptions = Object.assign({}, defaultOptions, {
        numberOfCourts: 1,
        numberOfRounds: 3
      });
      const matcher = new PickleballMatcher(minPlayers, minOptions);
      const schedule = await matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(THREE_ROUND_COUNT);
      expect(schedule.rounds[0]).toHaveLength(1); // Only 1 court for 4 players
    });

    it('should handle odd number of players', async () => {
      const oddPlayers = players.slice(0, EIGHT_PLAYER_COUNT); // 9 Players
      const opts = Object.assign({}, defaultOptions, {
        numberOfCourts: 2,
        numberOfRounds: 5
      });
      const matcher = new PickleballMatcher(oddPlayers, opts);
      const schedule = await matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(opts.numberOfRounds);
      // Should still generate valid schedule with some players resting
      expect(schedule.restingPlayers).toHaveLength(opts.numberOfRounds);
    });

    it('should handle zero rounds request', async () => {
      const zeroRoundsOptions = Object.assign({}, defaultOptions, {
        numberOfRounds: 0
      });
      const matcher = new PickleballMatcher(players, zeroRoundsOptions);
      const schedule = await matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(0);
      expect(schedule.restingPlayers).toHaveLength(0);
    });
  });

  describe('input validation and error handling', () => {
    it('should handle invalid skill levels', async () => {
      const invalidPlayers = [...players];
      invalidPlayers[0] = Object.assign({}, invalidPlayers[0], {
        skillLevel: -1
      }); // Invalid negative skill
      invalidPlayers[1] = Object.assign({}, invalidPlayers[1], {
        skillLevel: 10
      }); // Invalid high skill

      const matcher = new PickleballMatcher(invalidPlayers, defaultOptions);
      const schedule = await matcher.generateSchedule();

      // Should still generate a schedule despite invalid skill levels
      expect(schedule.rounds).toHaveLength(EIGHT_ROUND_COUNT);
    });
  });

  describe('schedule consistency', () => {
    it('should generate consistent schedules with same inputs', async () => {
      const matcher1 = new PickleballMatcher(players, defaultOptions);
      const matcher2 = new PickleballMatcher(players, defaultOptions);

      const schedule1 = await matcher1.generateSchedule('Test 1');
      const schedule2 = await matcher2.generateSchedule('Test 2');

      // Should have same structure
      expect(schedule1.rounds.length).toBe(schedule2.rounds.length);
      expect(schedule1.rounds[0].length).toBe(schedule2.rounds[0].length);

      // Events should be different but structure same
      expect(schedule1.eventLabel).toBe('Test 1');
      expect(schedule2.eventLabel).toBe('Test 2');
    });

    it('should maintain round structure across all rounds', async () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = await matcher.generateSchedule();

      // All rounds should have same number of courts when player count allows
      const expectedCourts = Math.min(defaultOptions.numberOfCourts, Math.floor(players.length / PLAYERS_PER_GAME));

      schedule.rounds.forEach((round: Game[], index: number) => {
        expect(round.length).toBeLessThanOrEqual(expectedCourts);
        expect(round.length).toBeGreaterThan(0);

        // Each game should be properly formed
        round.forEach((game: Game) => {
          expect(game.team1).toHaveLength(PAIR_SIZE);
          expect(game.team2).toHaveLength(PAIR_SIZE);
          expect(game.court).toBeGreaterThan(0);
          expect(game.round).toBe(index + 1);
        });
      });
    });

    it('should have exactly 4 resting players per round with 16 players, 3 courts, and 9 rounds', async () => {
      // Create test configuration with 16 players, 3 courts, and 9 rounds
      const nineRoundsOptions = Object.assign({}, defaultOptions, {
        numberOfRounds: 9
      });

      const matcher = new PickleballMatcher(players, nineRoundsOptions);
      const schedule = await matcher.generateSchedule();

      // Verify we have 9 rounds
      expect(schedule.rounds).toHaveLength(NINE_ROUND_COUNT);

      // Check each round's resting player count
      schedule.restingPlayers.forEach((restingPlayersInRound: string[], roundIndex: number) => {
        expect(
          restingPlayersInRound.length,
          `Round ${roundIndex + 1} should have exactly 4 resting players, but has ${restingPlayersInRound.length}`
        ).toBe(PLAYERS_PER_GAME);
      });

      // Verify the actual number of players playing in each round
      schedule.rounds.forEach((round: Game[], roundIndex: number) => {
        let playingPlayerCount = 0;

        round.forEach((_game: Game) => {
          // Each game has 4 players (2 per team)
          playingPlayerCount += PLAYERS_PER_GAME;
        });

        const expectedPlaying = players.length - PLAYERS_PER_GAME; // 16 - 4 = 12 players should be playing
        expect(
          playingPlayerCount,
          `Round ${roundIndex + 1} has ${playingPlayerCount} playing players, expected ${expectedPlaying}`
        ).toBe(expectedPlaying);
      });
    });
  });

  describe('first round sitters', () => {
    it('should respect firstRoundSitters option when specified', async () => {
      const optionsWithSitters: MatchingOptions = Object.assign({}, defaultOptions, {
        firstRoundSitters: ['1', '2', '3', '4'],
        numberOfRounds: 7
      });

      const matcher = new PickleballMatcher(players, optionsWithSitters);
      const schedule = await matcher.generateSchedule();

      // Verify the specified players are sitting in round 1
      const firstRoundSitters = schedule.restingPlayers[0];
      expect(firstRoundSitters).toContain('1');
      expect(firstRoundSitters).toContain('2');
      expect(firstRoundSitters).toContain('3');
      expect(firstRoundSitters).toContain('4');

      // Verify these players are NOT playing in round 1
      const firstRoundGames = schedule.rounds[0];
      firstRoundGames.forEach((game: Game) => {
        expect(game.team1).not.toContain('1');
        expect(game.team1).not.toContain('2');
        expect(game.team1).not.toContain('3');
        expect(game.team1).not.toContain('4');
        expect(game.team2).not.toContain('1');
        expect(game.team2).not.toContain('2');
        expect(game.team2).not.toContain('3');
        expect(game.team2).not.toContain('4');
      });
    });

    it('should work with fewer than 4 first round sitters', async () => {
      const optionsWithFewerSitters: MatchingOptions = Object.assign({}, defaultOptions, {
        firstRoundSitters: ['5', '6'],
        numberOfRounds: 7
      });

      const matcher = new PickleballMatcher(players, optionsWithFewerSitters);
      const schedule = await matcher.generateSchedule();

      // Verify the specified players are sitting in round 1
      const firstRoundSitters = schedule.restingPlayers[0];
      expect(firstRoundSitters).toContain('5');
      expect(firstRoundSitters).toContain('6');

      // Verify these players are NOT playing in round 1
      const firstRoundGames = schedule.rounds[0];
      firstRoundGames.forEach((game: Game) => {
        expect(game.team1).not.toContain('5');
        expect(game.team1).not.toContain('6');
        expect(game.team2).not.toContain('5');
        expect(game.team2).not.toContain('6');
      });
    });

    it('should work when firstRoundSitters is not specified', async () => {
      const optionsWithoutSitters: MatchingOptions = Object.assign({}, defaultOptions, {
        numberOfRounds: 7
        // firstRoundSitters is undefined
      });

      const matcher = new PickleballMatcher(players, optionsWithoutSitters);
      const schedule = await matcher.generateSchedule();

      // Just verify it generates a valid schedule
      expect(schedule.rounds).toHaveLength(SEVEN_ROUND_COUNT);
      expect(schedule.rounds[0]).toHaveLength(DEFAULT_COURT_COUNT); // 3 courts
      validateAllGamesHavePlayers(schedule);
    });
  });
});
