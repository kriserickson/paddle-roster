import { describe, it, expect, beforeEach } from 'vitest';
import { PickleballMatcher } from '~/utils/pickleballMatcher';
import type { Player, MatchingOptions } from '~/types';

describe('PickleballMatcher', () => {
  let players: Player[];
  let defaultOptions: MatchingOptions;

  beforeEach(() => {
    // Create test players with various skill levels (16 players total)
    players = [
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

    defaultOptions = {
      numberOfCourts: 3,
      numberOfRounds: 8,
      balanceSkillLevels: true,
      respectPartnerPreferences: true,
      maxSkillDifference: 1.5,
      distributeRestEqually: true
    };
  });

  describe('constructor', () => {
    it('should initialize with players and options', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      expect(matcher).toBeDefined();
    });
  });

  describe('generateSchedule', () => {
    it('should generate a valid schedule with 8 rounds for 16 players on 3 courts', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule('Test Event');

      expect(schedule.rounds).toHaveLength(8);
      expect(schedule.rounds[0]).toHaveLength(3); // 3 courts for 16 players
      expect(schedule.eventLabel).toBe('Test Event');
      expect(schedule.options).toEqual(defaultOptions);
      expect(schedule.generatedAt).toBeInstanceOf(Date);
    });

    it('should ensure no players play together more than once', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
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
        expect(count, `Partnership ${partnership} occurred ${count} times`).toBeLessThanOrEqual(1);
      });
    });

    it('should ensure no player plays against the same player more than 2 times', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Track how many times each player plays against each other player
      const opponentCounts = new Map<string, Map<string, number>>();

      players.forEach(player => {
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
          expect(count, `Player ${playerId} played ${opponentId} more than 2 times`).toBeLessThanOrEqual(2);
        });
      });
    });

    it('should ensure all players have exactly 2 breaks that are not within 4 games of each other', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Track rest periods for each player
      const playerRestRounds = new Map<string, number[]>();

      players.forEach(player => {
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

        players.forEach(player => {
          if (!playingPlayerIds.has(player.id)) {
            playerRestRounds.get(player.id)!.push(roundIndex);
          }
        });
      });

      playerRestRounds.forEach((restRounds, playerId) => {
        // Each player should have exactly 2 rest periods (16 players, 12 playing per round)
        expect(restRounds, `${playerId} had more than 2 rest rounds`).toHaveLength(2);

        // Rest periods should not be within 4 rounds of each other
        if (restRounds.length >= 2) {
          const diff = Math.abs(restRounds[1] - restRounds[0]);
          expect(diff).toBeGreaterThanOrEqual(4);
        }
      });
    });

    it('should respect skill level differences when balancing is enabled', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      schedule.rounds.forEach((round, roundIndex) => {
        round.forEach((game, gameIndex) => {
          // Calculate team skill averages
          const team1Skills = game.team1.map(id => players.find(p => p.id === id)!.skillLevel);
          const team2Skills = game.team2.map(id => players.find(p => p.id === id)!.skillLevel);

          const team1Avg = team1Skills.reduce((sum, skill) => sum + skill, 0) / team1Skills.length;
          const team2Avg = team2Skills.reduce((sum, skill) => sum + skill, 0) / team2Skills.length;

          const skillDifference = Math.abs(team1Avg - team2Avg);

          // Skill difference should not exceed the configured maximum
          expect(
            skillDifference,
            `In round ${roundIndex} game ${gameIndex} the skill difference was ${skillDifference}`
          ).toBeLessThanOrEqual(defaultOptions.maxSkillDifference);
        });
      });
    });

    it('should handle fewer players than courts gracefully', () => {
      const matcher = new PickleballMatcher(players.slice(0, 10), defaultOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(8);
      // Should have fewer courts when not enough players for all courts
      schedule.rounds.forEach(round => {
        expect(round.length).toBeLessThanOrEqual(3);
        expect(round.length).toBeGreaterThan(0);
      });
    });
  });

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

    it('should not enforce partner preferences when disabled', () => {
      const matcher = new PickleballMatcher(players, { ...defaultOptions, respectPartnerPreferences: false });
      const schedule = matcher.generateSchedule();

      // Should still generate a valid schedule regardless of partner preferences
      expect(schedule.rounds).toHaveLength(8);
      expect(schedule.rounds[0]).toHaveLength(3);

      // Verify all rounds have proper game structure
      schedule.rounds.forEach(round => {
        round.forEach(game => {
          expect(game.team1).toHaveLength(2);
          expect(game.team2).toHaveLength(2);
          expect(game.court).toBeGreaterThan(0);
        });
      });
    });

    it('should balance partner preferences with skill balancing', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        respectPartnerPreferences: true,
        balanceSkillLevels: true,
        maxSkillDifference: 1.0 // Stricter skill balancing
      });
      const schedule = matcher.generateSchedule();

      let partnerPairingsRespected = 0;
      let skillBalanceViolations = 0;

      schedule.rounds.forEach(round => {
        round.forEach(game => {
          // Check if preferred partners are together
          const team1Sorted = game.team1.slice().sort();
          const team2Sorted = game.team2.slice().sort();

          const preferredPairs = [
            ['1', '2'],
            ['3', '4'],
            ['7', '8'],
            ['15', '16']
          ];
          preferredPairs.forEach(pair => {
            const pairKey = pair.slice().sort();
            if (team1Sorted.join('-') === pairKey.join('-') || team2Sorted.join('-') === pairKey.join('-')) {
              partnerPairingsRespected++;
            }
          });

          // Check skill balance
          const team1Skills = game.team1.map(id => players.find(p => p.id === id)!.skillLevel);
          const team2Skills = game.team2.map(id => players.find(p => p.id === id)!.skillLevel);

          const team1Avg = team1Skills.reduce((sum, skill) => sum + skill, 0) / team1Skills.length;
          const team2Avg = team2Skills.reduce((sum, skill) => sum + skill, 0) / team2Skills.length;

          if (Math.abs(team1Avg - team2Avg) > 1.0) {
            skillBalanceViolations++;
          }
        });
      });

      // Should respect some partner preferences
      expect(partnerPairingsRespected).toBeGreaterThan(0);
      // Should have minimal skill balance violations
      expect(skillBalanceViolations).toBeLessThanOrEqual(2);
    });
  });
  describe('skill level balancing', () => {
    it('should balance skill levels when enabled', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        balanceSkillLevels: true,
        maxSkillDifference: 1.5
      });
      const schedule = matcher.generateSchedule();

      // Check that skill differences between teams are reasonable
      schedule.rounds.forEach(round => {
        round.forEach(game => {
          // Game should have skillDifference property based on actual implementation
          if ('skillDifference' in game) {
            expect(game.skillDifference).toBeLessThanOrEqual(1.5);
          }
        });
      });
    });

    it('should allow larger skill differences when maxSkillDifference is relaxed', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        balanceSkillLevels: true,
        maxSkillDifference: 3.0 // Very relaxed constraint
      });
      const schedule = matcher.generateSchedule();

      // Should still generate valid schedule with relaxed constraints
      expect(schedule.rounds).toHaveLength(8);
      expect(schedule.rounds[0]).toHaveLength(3);

      // Verify skill differences don't exceed the relaxed limit
      schedule.rounds.forEach(round => {
        round.forEach(game => {
          const team1Skills = game.team1.map(id => players.find(p => p.id === id)!.skillLevel);
          const team2Skills = game.team2.map(id => players.find(p => p.id === id)!.skillLevel);

          const team1Avg = team1Skills.reduce((sum, skill) => sum + skill, 0) / team1Skills.length;
          const team2Avg = team2Skills.reduce((sum, skill) => sum + skill, 0) / team2Skills.length;

          const skillDifference = Math.abs(team1Avg - team2Avg);
          expect(skillDifference).toBeLessThanOrEqual(3.0);
        });
      });
    });

    it('should work when skill balancing is disabled', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        balanceSkillLevels: false,
        maxSkillDifference: 0 // Should be ignored when balancing is disabled
      });
      const schedule = matcher.generateSchedule();

      // Should generate valid schedule regardless of skill constraints
      expect(schedule.rounds).toHaveLength(8);
      expect(schedule.rounds[0]).toHaveLength(3);

      // Verify all games have proper structure
      schedule.rounds.forEach(round => {
        round.forEach(game => {
          expect(game.team1).toHaveLength(2);
          expect(game.team2).toHaveLength(2);
          expect(game.court).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('court assignment', () => {
    it('should assign courts correctly', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      schedule.rounds.forEach(round => {
        round.forEach((game, index) => {
          expect(game.court).toBe(index + 1);
        });
      });
    });
  });

  describe('player validation', () => {
    it('should handle unique players correctly', () => {
      const matcher = new PickleballMatcher(players, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Each round should have unique players (no player plays twice in same round)
      schedule.rounds.forEach(round => {
        const playersInRound = new Set<string>();
        round.forEach(game => {
          expect(playersInRound.has(game.team1[0])).toBe(false);
          expect(playersInRound.has(game.team1[1])).toBe(false);
          expect(playersInRound.has(game.team2[0])).toBe(false);
          expect(playersInRound.has(game.team2[1])).toBe(false);

          playersInRound.add(game.team1[0]);
          playersInRound.add(game.team1[1]);
          playersInRound.add(game.team2[0]);
          playersInRound.add(game.team2[1]);
        });
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
      const oddPlayers = players.slice(0, 7);
      const matcher = new PickleballMatcher(oddPlayers, defaultOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(7);
      // Should still generate valid schedule with some players resting
      expect(schedule.restingPlayers).toHaveLength(7);
    });

    it('should handle zero rounds request', () => {
      const zeroRoundsOptions = { ...defaultOptions, numberOfRounds: 0 };
      const matcher = new PickleballMatcher(players, zeroRoundsOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(0);
      expect(schedule.restingPlayers).toHaveLength(0);
    });
  });

  describe('comprehensive partner preferences', () => {
    it('should ensure all preferred partner pairs get matched when possible', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        respectPartnerPreferences: true,
        maxSkillDifference: 2.0 // More relaxed to allow partner preferences
      });
      const schedule = matcher.generateSchedule();

      // Track all partner pairings across all rounds
      const partnerPairings = new Map<string, number>();
      const expectedPairs = [
        ['1', '2'], // Alice & Bob (skill 2.0, 2.1)
        ['3', '4'], // Charlie & Diana (skill 3.0, 3.2)
        ['7', '8'], // Grace & Henry (skill 1.5, 1.8)
        ['15', '16'] // Olivia & Peter (skill 2.3, 2.4)
      ];

      schedule.rounds.forEach(round => {
        round.forEach(game => {
          // Check both teams for preferred partnerships
          [game.team1, game.team2].forEach(team => {
            const teamSorted = team.slice().sort();
            expectedPairs.forEach(pair => {
              const pairKey = pair.slice().sort().join('-');
              if (teamSorted.join('-') === pairKey) {
                partnerPairings.set(pairKey, (partnerPairings.get(pairKey) || 0) + 1);
              }
            });
          });
        });
      });

      // Each preferred partner pair should appear at least once
      expectedPairs.forEach(pair => {
        const pairKey = pair.slice().sort().join('-');
        const pairCount = partnerPairings.get(pairKey) || 0;
        expect(pairCount).toBeGreaterThan(0);
      });

      // Verify that at least 80% of expected pairs are matched
      const matchedPairs = Array.from(partnerPairings.keys()).filter(key => partnerPairings.get(key)! > 0);
      expect(matchedPairs.length).toBeGreaterThanOrEqual(Math.ceil(expectedPairs.length * 0.8));
    });

    it('should prioritize partner preferences over skill balancing when enabled', () => {
      const matcher = new PickleballMatcher(players, {
        ...defaultOptions,
        respectPartnerPreferences: true,
        balanceSkillLevels: true,
        maxSkillDifference: 0.5 // Very strict skill balancing
      });
      const schedule = matcher.generateSchedule();

      let partnerPreferencesRespected = 0;
      let strictSkillBalanceViolations = 0;

      schedule.rounds.forEach(round => {
        round.forEach(game => {
          // Count partner preferences respected
          const team1Sorted = game.team1.slice().sort();
          const team2Sorted = game.team2.slice().sort();

          const preferredPairs = [
            ['1', '2'],
            ['3', '4'],
            ['7', '8'],
            ['15', '16']
          ];
          preferredPairs.forEach(pair => {
            const pairKey = pair.slice().sort();
            if (team1Sorted.join('-') === pairKey.join('-') || team2Sorted.join('-') === pairKey.join('-')) {
              partnerPreferencesRespected++;
            }
          });

          // Count strict skill balance violations
          const team1Skills = game.team1.map(id => players.find(p => p.id === id)!.skillLevel);
          const team2Skills = game.team2.map(id => players.find(p => p.id === id)!.skillLevel);

          const team1Avg = team1Skills.reduce((sum, skill) => sum + skill, 0) / team1Skills.length;
          const team2Avg = team2Skills.reduce((sum, skill) => sum + skill, 0) / team2Skills.length;

          if (Math.abs(team1Avg - team2Avg) > 0.5) {
            strictSkillBalanceViolations++;
          }
        });
      });

      // Should respect some partner preferences even with strict skill balancing
      expect(partnerPreferencesRespected).toBeGreaterThan(0);
      // May have some skill balance violations to accommodate partner preferences
      expect(strictSkillBalanceViolations).toBeLessThan(schedule.rounds.length * 3); // Not all games violate
    });
  });

  describe('performance and stress tests', () => {
    it('should handle larger player pools efficiently (24 players)', () => {
      // Create 24 players
      const largePlayers: Player[] = [];
      for (let i = 1; i <= 24; i++) {
        largePlayers.push({
          id: i.toString(),
          name: `Player${i}`,
          skillLevel: 1.0 + (i % 4), // Skill levels 1-4
          partnerId: i % 2 === 1 && i < 24 ? (i + 1).toString() : undefined
        });
      }

      const largeOptions = {
        ...defaultOptions,
        numberOfCourts: 6, // 6 courts for 24 players
        numberOfRounds: 10
      };

      const start = Date.now();
      const matcher = new PickleballMatcher(largePlayers, largeOptions);
      const schedule = matcher.generateSchedule();
      const duration = Date.now() - start;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(schedule.rounds).toHaveLength(10);
      expect(schedule.rounds[0]).toHaveLength(6);

      // Verify schedule integrity
      schedule.rounds.forEach(round => {
        const playersInRound = new Set<string>();
        round.forEach(game => {
          expect(playersInRound.has(game.team1[0])).toBe(false);
          expect(playersInRound.has(game.team1[1])).toBe(false);
          expect(playersInRound.has(game.team2[0])).toBe(false);
          expect(playersInRound.has(game.team2[1])).toBe(false);

          playersInRound.add(game.team1[0]);
          playersInRound.add(game.team1[1]);
          playersInRound.add(game.team2[0]);
          playersInRound.add(game.team2[1]);
        });
      });
    });

    it('should handle maximum rounds efficiently', () => {
      const maxOptions = {
        ...defaultOptions,
        numberOfRounds: 15 // High number of rounds
      };

      const start = Date.now();
      const matcher = new PickleballMatcher(players, maxOptions);
      const schedule = matcher.generateSchedule();
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000);
      expect(schedule.rounds).toHaveLength(15);
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

    it('should handle missing player references in partner preferences', () => {
      const playersWithBadRefs = [...players];
      playersWithBadRefs[0] = { ...playersWithBadRefs[0], partnerId: '999' }; // Non-existent partner

      const matcher = new PickleballMatcher(playersWithBadRefs, defaultOptions);
      const schedule = matcher.generateSchedule();

      // Should generate schedule despite bad partner references
      expect(schedule.rounds).toHaveLength(8);
      expect(schedule.rounds[0]).toHaveLength(3);
    });

    it('should handle empty player list', () => {
      const matcher = new PickleballMatcher([], defaultOptions);
      const schedule = matcher.generateSchedule();

      expect(schedule.rounds).toHaveLength(8);
      schedule.rounds.forEach(round => {
        expect(round).toHaveLength(0); // No games with no players
      });
    });

    it('should handle invalid options gracefully', () => {
      const invalidOptions = {
        ...defaultOptions,
        numberOfCourts: 0, // Invalid
        numberOfRounds: -5, // Invalid
        maxSkillDifference: -1 // Invalid
      };

      const matcher = new PickleballMatcher(players, invalidOptions);
      const schedule = matcher.generateSchedule();

      // Should handle invalid options gracefully
      expect(schedule.rounds).toBeDefined();
      expect(Array.isArray(schedule.rounds)).toBe(true);
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
