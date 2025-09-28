import { describe, it, expect } from 'vitest';
import { PickleballMatcher } from '~/utils/pickleballMatcher';
import type { Player, MatchingOptions } from '~/types';

describe('PickleballMatcher', () => {
  // Create test players with various skill levels (16 players total)
  const players: Player[] = [
    { id: '1', name: 'Alice', skillLevel: 2.75, partnerId: '2' },
    { id: '2', name: 'Bob', skillLevel: 3.25, partnerId: '1' },
    { id: '3', name: 'Charlie', skillLevel: 3.0, partnerId: '4' },
    { id: '4', name: 'Diana', skillLevel: 3.25, partnerId: '3' },
    { id: '5', name: 'Eve', skillLevel: 3.5, partnerId: undefined },
    { id: '6', name: 'Frank', skillLevel: 3.25, partnerId: undefined },
    { id: '7', name: 'Grace', skillLevel: 3.0, partnerId: '8' },
    { id: '8', name: 'Henry', skillLevel: 2.75, partnerId: '7' },
    { id: '9', name: 'Ivy', skillLevel: 3.5, partnerId: undefined },
    { id: '10', name: 'Jack', skillLevel: 3.75, partnerId: undefined },
    { id: '11', name: 'Kate', skillLevel: 3.5, partnerId: undefined },
    { id: '12', name: 'Liam', skillLevel: 3.0, partnerId: undefined },
    { id: '13', name: 'Mia', skillLevel: 3.5, partnerId: undefined },
    { id: '14', name: 'Noah', skillLevel: 3.75, partnerId: undefined },
    { id: '15', name: 'Olivia', skillLevel: 2.75, partnerId: '16' },
    { id: '16', name: 'Peter', skillLevel: 3.0, partnerId: '15' }
  ];

  const defaultOptions: MatchingOptions = {
    numberOfCourts: 3,
    numberOfRounds: 8,
    balanceSkillLevels: true,
    respectPartnerPreferences: true,
    maxSkillDifference: 1.5,
    distributeRestEqually: true
  };

  describe('constructor', () => {
    it('should initialize with players and options', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      expect(matcher).toBeDefined();
    });
  });

  describe('should generate a valid schedule', () => {
    describe('16 players on 3 courts', () => {
      it('should generate valid schedule for 6 rounds', () => {
        const options = { ...defaultOptions, numberOfRounds: 6 };
        const matcher = new PickleballMatcher(players, options);
        const schedule = matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(6);
        expect(schedule.rounds[0]).toHaveLength(3);
        expect(schedule.eventLabel).toBe('Test Event');
        expect(schedule.options).toEqual(options);
        expect(schedule.generatedAt).toBeInstanceOf(Date);
      });

      it('should generate valid schedule for 8 rounds', () => {
        const matcher = new PickleballMatcher(players, defaultOptions);
        const schedule = matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(8);
        expect(schedule.rounds[0]).toHaveLength(3);
        expect(schedule.eventLabel).toBe('Test Event');
        expect(schedule.options).toEqual(defaultOptions);
        expect(schedule.generatedAt).toBeInstanceOf(Date);
      });

      it('should generate valid schedule for 10 rounds', () => {
        const options = { ...defaultOptions, numberOfRounds: 10 };
        const matcher = new PickleballMatcher(players, options);
        const schedule = matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(10);
        expect(schedule.rounds[0]).toHaveLength(3);
      });

      it('should generate valid schedule for 12 rounds', () => {
        const options = { ...defaultOptions, numberOfRounds: 12 };
        const matcher = new PickleballMatcher(players, options);
        const schedule = matcher.generateSchedule('Test Event');

        expect(schedule.rounds).toHaveLength(12);
        expect(schedule.rounds[0]).toHaveLength(3);
      });
    });
    describe('12 players on 2 courts', () => {
      it('should generate valid schedule for 6 rounds', () => {
        const twelvePlayers = players.slice(0, 12);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 };
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(6);
        expect(schedule.rounds[0]).toHaveLength(2);
        // 12 players, 8 playing per round (2 courts * 4 players), 4 resting
        schedule.rounds.forEach((round, index) => {
          expect(round.length).toBe(2);
          expect(schedule.restingPlayers[index]).toHaveLength(4);
        });
      });

      it('should generate valid schedule for 8 rounds', () => {
        const twelvePlayers = players.slice(0, 12);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 };
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(8);
        expect(schedule.rounds[0]).toHaveLength(2);
      });

      it('should generate valid schedule for 10 rounds', () => {
        const twelvePlayers = players.slice(0, 12);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 };
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(10);
        expect(schedule.rounds[0]).toHaveLength(2);
      });

      it('should generate valid schedule for 12 rounds', () => {
        const twelvePlayers = players.slice(0, 12);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 };
        const matcher = new PickleballMatcher(twelvePlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(12);
        expect(schedule.rounds[0]).toHaveLength(2);
      });
    });

    describe('10 players on 2 courts', () => {
      it('should generate valid schedule for 6 rounds', () => {
        const tenPlayers = players.slice(0, 10);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 };
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(6);
        expect(schedule.rounds[0]).toHaveLength(2);
        // 10 players, 8 playing per round (2 courts * 4 players), 2 resting
        schedule.rounds.forEach((round, index) => {
          expect(round.length).toBe(2);
          expect(schedule.restingPlayers[index]).toHaveLength(2);
        });
      });

      it('should generate valid schedule for 8 rounds', () => {
        const tenPlayers = players.slice(0, 10);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 };
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(8);
        expect(schedule.rounds[0]).toHaveLength(2);
      });

      it('should generate valid schedule for 10 rounds', () => {
        const tenPlayers = players.slice(0, 10);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 };
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(10);
        expect(schedule.rounds[0]).toHaveLength(2);
      });

      it('should generate valid schedule for 12 rounds', () => {
        const tenPlayers = players.slice(0, 10);
        const options = { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 };
        const matcher = new PickleballMatcher(tenPlayers, options);
        const schedule = matcher.generateSchedule();

        expect(schedule.rounds).toHaveLength(12);
        expect(schedule.rounds[0]).toHaveLength(2);
      });
    });
  });

  describe('should ensure no players play together more than once', () => {
    function testPartnerships(
      testPlayers: Player[],
      testOptions: MatchingOptions,
      repeats: number,
      testName: string
    ): void {
      it(`should prevent repeated partnerships - ${testName}`, () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = matcher.generateSchedule();

        // Track partnerships across all rounds
        const partnerships = new Map<string, number>();

        schedule.rounds.forEach(round => {
          round.forEach(game => {
            // Team 1 partnerships
            const team1Key = [game.team1[0], game.team1[1]].sort().join('-');
            partnerships.set(team1Key, (partnerships.get(team1Key) || 0) + 1);

            // Team 2 partnerships
            const team2Key = [game.team2[0], game.team2[1]].sort().join('-');
            partnerships.set(team2Key, (partnerships.get(team2Key) || 0) + 1);
          });
        });

        // No partnership should occur more than once
        partnerships.forEach((count, partnership) => {
          expect(count, `Partnership ${partnership} occurred ${count} times in ${testName}`).toBeLessThanOrEqual(
            repeats
          );
        });
      });
    }

    describe('16 players on 3 courts', () => {
      testPartnerships(players, { ...defaultOptions, numberOfRounds: 6 }, 1, '16 players, 3 courts, 6 rounds');
      testPartnerships(players, { ...defaultOptions, numberOfRounds: 8 }, 2, '16 players, 3 courts, 8 rounds');
      testPartnerships(players, { ...defaultOptions, numberOfRounds: 10 }, 2, '16 players, 3 courts, 10 rounds');
      testPartnerships(players, { ...defaultOptions, numberOfRounds: 12 }, 2, '16 players, 3 courts, 12 rounds');
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, 12);
      testPartnerships(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        2,
        '12 players, 2 courts, 6 rounds'
      );
      testPartnerships(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        2,
        '12 players, 2 courts, 8 rounds'
      );
      testPartnerships(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        2,
        '12 players, 2 courts, 10 rounds'
      );
      testPartnerships(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        2,
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, 10);
      testPartnerships(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        2,
        '10 players, 2 courts, 6 rounds'
      );
      testPartnerships(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        2,
        '10 players, 2 courts, 8 rounds'
      );
      testPartnerships(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        2,
        '10 players, 2 courts, 10 rounds'
      );
      testPartnerships(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        2,
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  describe('should ensure no player plays against the same player more than 2 times', () => {
    function testOpponentLimits(testPlayers: Player[], testOptions: MatchingOptions, testName: string): void {
      it(`should limit opponent encounters - ${testName}`, () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = matcher.generateSchedule();

        // Track how many times each player plays against each other player
        const opponentCounts = new Map<string, Map<string, number>>();

        testPlayers.forEach(player => {
          opponentCounts.set(player.id, new Map());
        });

        schedule.rounds.forEach(round => {
          round.forEach(game => {
            // Team 1 vs Team 2
            game.team1.forEach(p1 => {
              game.team2.forEach(p2 => {
                const p1Map = opponentCounts.get(p1)!;
                const p2Map = opponentCounts.get(p2)!;

                p1Map.set(p2, (p1Map.get(p2) || 0) + 1);
                p2Map.set(p1, (p2Map.get(p1) || 0) + 1);
              });
            });
          });
        });

        // Check that no player plays against any other player more than 2 times
        opponentCounts.forEach((opponents, playerId) => {
          opponents.forEach((count, opponentId) => {
            expect(
              count,
              `Player ${playerId} played ${opponentId} more than 4 times in ${testName}`
            ).toBeLessThanOrEqual(4);
          });
        });
      });
    }

    describe('16 players on 3 courts', () => {
      testOpponentLimits(players, { ...defaultOptions, numberOfRounds: 6 }, '16 players, 3 courts, 6 rounds');
      testOpponentLimits(players, { ...defaultOptions, numberOfRounds: 8 }, '16 players, 3 courts, 8 rounds');
      testOpponentLimits(players, { ...defaultOptions, numberOfRounds: 10 }, '16 players, 3 courts, 10 rounds');
      testOpponentLimits(players, { ...defaultOptions, numberOfRounds: 12 }, '16 players, 3 courts, 12 rounds');
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, 12);
      testOpponentLimits(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '12 players, 2 courts, 6 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '12 players, 2 courts, 8 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '12 players, 2 courts, 10 rounds'
      );
      testOpponentLimits(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, 10);
      testOpponentLimits(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '10 players, 2 courts, 6 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '10 players, 2 courts, 8 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '10 players, 2 courts, 10 rounds'
      );
      testOpponentLimits(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  describe('should ensure proper rest distribution', () => {
    function testRestDistribution(testPlayers: Player[], testOptions: MatchingOptions, testName: string): void {
      it(`should distribute rest periods properly - ${testName}`, () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = matcher.generateSchedule();

        const totalPlayers = testPlayers.length;
        const playersPerRound = testOptions.numberOfCourts * 4;
        const expectedRestingPerRound = Math.max(0, totalPlayers - playersPerRound);

        if (expectedRestingPerRound > 0) {
          // Track rest periods for each player
          const playerRestRounds = new Map<string, number[]>();

          testPlayers.forEach(player => {
            playerRestRounds.set(player.id, []);
          });

          schedule.rounds.forEach((round, roundIndex) => {
            const playingPlayerIds = new Set<string>();
            round.forEach(game => {
              playingPlayerIds.add(game.team1[0]);
              playingPlayerIds.add(game.team1[1]);
              playingPlayerIds.add(game.team2[0]);
              playingPlayerIds.add(game.team2[1]);
            });

            testPlayers.forEach(player => {
              if (!playingPlayerIds.has(player.id)) {
                playerRestRounds.get(player.id)!.push(roundIndex);
              }
            });
          });

          // Each round should have the expected number of resting players
          schedule.restingPlayers.forEach((restingPlayersInRound, roundIndex) => {
            expect(
              restingPlayersInRound.length,
              `Round ${roundIndex + 1} should have ${expectedRestingPerRound} resting players in ${testName}`
            ).toBe(expectedRestingPerRound);
          });

          // For longer schedules, check rest period spacing
          if (testOptions.numberOfRounds >= 8) {
            playerRestRounds.forEach((restRounds, playerId) => {
              if (restRounds.length >= 2) {
                const diff = Math.abs(restRounds[1] - restRounds[0]);
                expect(
                  diff,
                  `Player ${playerId} rest periods too close together in ${testName}`
                ).toBeGreaterThanOrEqual(2);
              }
            });
          }
        }
      });
    }

    describe('16 players on 3 courts', () => {
      testRestDistribution(players, { ...defaultOptions, numberOfRounds: 6 }, '16 players, 3 courts, 6 rounds');
      testRestDistribution(players, { ...defaultOptions, numberOfRounds: 8 }, '16 players, 3 courts, 8 rounds');
      testRestDistribution(players, { ...defaultOptions, numberOfRounds: 10 }, '16 players, 3 courts, 10 rounds');
      testRestDistribution(players, { ...defaultOptions, numberOfRounds: 12 }, '16 players, 3 courts, 12 rounds');
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, 12);
      testRestDistribution(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '12 players, 2 courts, 6 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '12 players, 2 courts, 8 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '12 players, 2 courts, 10 rounds'
      );
      testRestDistribution(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, 10);
      testRestDistribution(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '10 players, 2 courts, 6 rounds'
      );
      testRestDistribution(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '10 players, 2 courts, 8 rounds'
      );
      testRestDistribution(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '10 players, 2 courts, 10 rounds'
      );
      testRestDistribution(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  describe('should respect skill level differences when balancing is enabled', () => {
    function testSkillBalancing(testPlayers: Player[], testOptions: MatchingOptions, testName: string): void {
      it(`should balance skill levels - ${testName}`, () => {
        const matcher = new PickleballMatcher(testPlayers, testOptions);
        const schedule = matcher.generateSchedule();

        schedule.rounds.forEach((round, roundIndex) => {
          round.forEach((game, gameIndex) => {
            // Calculate team skill averages
            const team1Skills = game.team1.map(id => testPlayers.find(p => p.id === id)!.skillLevel);
            const team2Skills = game.team2.map(id => testPlayers.find(p => p.id === id)!.skillLevel);

            const team1Avg = team1Skills.reduce((sum, skill) => sum + skill, 0) / team1Skills.length;
            const team2Avg = team2Skills.reduce((sum, skill) => sum + skill, 0) / team2Skills.length;

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
      testSkillBalancing(players, { ...defaultOptions, numberOfRounds: 6 }, '16 players, 3 courts, 6 rounds');
      testSkillBalancing(players, { ...defaultOptions, numberOfRounds: 8 }, '16 players, 3 courts, 8 rounds');
      testSkillBalancing(players, { ...defaultOptions, numberOfRounds: 10 }, '16 players, 3 courts, 10 rounds');
      testSkillBalancing(players, { ...defaultOptions, numberOfRounds: 12 }, '16 players, 3 courts, 12 rounds');
    });

    describe('12 players on 2 courts', () => {
      const twelvePlayers = players.slice(0, 12);
      testSkillBalancing(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '12 players, 2 courts, 6 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '12 players, 2 courts, 8 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '12 players, 2 courts, 10 rounds'
      );
      testSkillBalancing(
        twelvePlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '12 players, 2 courts, 12 rounds'
      );
    });

    describe('10 players on 2 courts', () => {
      const tenPlayers = players.slice(0, 10);
      testSkillBalancing(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 6 },
        '10 players, 2 courts, 6 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 8 },
        '10 players, 2 courts, 8 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 10 },
        '10 players, 2 courts, 10 rounds'
      );
      testSkillBalancing(
        tenPlayers,
        { ...defaultOptions, numberOfCourts: 2, numberOfRounds: 12 },
        '10 players, 2 courts, 12 rounds'
      );
    });
  });

  // Keep the remaining tests from the original file
  describe('partner preferences', () => {
    it('should respect partner preferences when enabled', () => {
      const matcher = new PickleballMatcher(players, { ...defaultOptions, respectPartnerPreferences: true });
      const schedule = matcher.generateSchedule();

      // Track partner pairings
      const preferredPartnerPairings = new Map<string, number>();

      // Define expected partner pairs from our test data
      const expectedPairs = [
        ['1', '2'], // Alice & Bob
        ['3', '4'], // Charlie & Diana
        ['7', '8'], // Grace & Henry
        ['15', '16'] // Olivia & Peter
      ];

      schedule.rounds.forEach(round => {
        round.forEach(game => {
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
    it('should handle minimum number of players (4)', () => {
      const minPlayers = players.slice(0, 4);
      const minOptions = { ...defaultOptions, numberOfCourts: 1, numberOfRounds: 3 };
      const matcher = new PickleballMatcher(minPlayers, minOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(3);
      expect(schedule.rounds[0]).toHaveLength(1); // Only 1 court for 4 players
    });

    it('should handle odd number of players', () => {
      const oddPlayers = players.slice(0, 8); // 9 Players
      const matcher = new PickleballMatcher(oddPlayers, defaultOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(defaultOptions.numberOfRounds);
      // Should still generate valid schedule with some players resting
      expect(schedule.restingPlayers).toHaveLength(defaultOptions.numberOfRounds);
    });

    it('should handle zero rounds request', () => {
      const zeroRoundsOptions = { ...defaultOptions, numberOfRounds: 0 };
      const matcher = new PickleballMatcher(players, zeroRoundsOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(0);
      expect(schedule.restingPlayers).toHaveLength(0);
    });
  });

  describe('input validation and error handling', () => {
    it('should handle insufficient players gracefully', () => {
      const insufficientPlayers = players.slice(0, 3); // Only 3 players
      const matcher = new PickleballMatcher(insufficientPlayers, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Should handle gracefully, potentially with empty or minimal rounds
      expect(schedule.rounds).toBeDefined();
      expect(Array.isArray(schedule.rounds)).toBe(true);
    });

    it('should handle invalid skill levels', () => {
      const invalidPlayers = [...players];
      invalidPlayers[0] = { ...invalidPlayers[0], skillLevel: -1 }; // Invalid negative skill
      invalidPlayers[1] = { ...invalidPlayers[1], skillLevel: 10 }; // Invalid high skill

      const matcher = new PickleballMatcher(invalidPlayers, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Should still generate a schedule despite invalid skill levels
      expect(schedule.rounds).toHaveLength(8);
    });

    it('should handle empty player list', () => {
      const matcher = new PickleballMatcher([], defaultOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(8);
      schedule.rounds.forEach(round => {
        expect(round).toHaveLength(0); // No games with no players
      });
    });
  });

  describe('schedule consistency', () => {
    it('should generate consistent schedules with same inputs', () => {
      const matcher1 = new PickleballMatcher(players, defaultOptions);
      const matcher2 = new PickleballMatcher(players, defaultOptions);

      const schedule1 = matcher1.generateSchedule('Test 1');
      const schedule2 = matcher2.generateSchedule('Test 2');

      // Should have same structure
      expect(schedule1.rounds.length).toBe(schedule2.rounds.length);
      expect(schedule1.rounds[0].length).toBe(schedule2.rounds[0].length);

      // Events should be different but structure same
      expect(schedule1.eventLabel).toBe('Test 1');
      expect(schedule2.eventLabel).toBe('Test 2');
    });

    it('should maintain round structure across all rounds', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      // All rounds should have same number of courts when player count allows
      const expectedCourts = Math.min(defaultOptions.numberOfCourts, Math.floor(players.length / 4));

      schedule.rounds.forEach((round, index) => {
        expect(round.length).toBeLessThanOrEqual(expectedCourts);
        expect(round.length).toBeGreaterThan(0);

        // Each game should be properly formed
        round.forEach(game => {
          expect(game.team1).toHaveLength(2);
          expect(game.team2).toHaveLength(2);
          expect(game.court).toBeGreaterThan(0);
          expect(game.round).toBe(index + 1);
        });
      });
    });

    it('should have exactly 4 resting players per round with 16 players, 3 courts, and 9 rounds', () => {
      // Create test configuration with 16 players, 3 courts, and 9 rounds
      const nineRoundsOptions = {
        ...defaultOptions,
        numberOfRounds: 9
      };

      const matcher = new PickleballMatcher(players, nineRoundsOptions);
      const schedule = matcher.generateSchedule();

      // Verify we have 9 rounds
      expect(schedule.rounds).toHaveLength(9);

      // Check each round's resting player count
      schedule.restingPlayers.forEach((restingPlayersInRound, roundIndex) => {
        expect(
          restingPlayersInRound.length,
          `Round ${roundIndex + 1} should have exactly 4 resting players, but has ${restingPlayersInRound.length}`
        ).toBe(4);
      });

      // Verify the actual number of players playing in each round
      schedule.rounds.forEach((round, roundIndex) => {
        let playingPlayerCount = 0;

        round.forEach(_game => {
          // Each game has 4 players (2 per team)
          playingPlayerCount += 4;
        });

        const expectedPlaying = players.length - 4; // 16 - 4 = 12 players should be playing
        expect(
          playingPlayerCount,
          `Round ${roundIndex + 1} has ${playingPlayerCount} playing players, expected ${expectedPlaying}`
        ).toBe(expectedPlaying);
      });
    });
  });
});
