import { describe, it, expect, beforeEach } from 'vitest'
import { PickleballMatcher } from '../../utils/pickleballMatcher'
import type { Player, MatchingOptions } from '../../types'

describe('PickleballMatcher', () => {
  let players: Player[]
  let defaultOptions: MatchingOptions

  beforeEach(() => {
    // Create test players with various skill levels
    players = [
      { id: '1', name: 'Alice', skillLevel: 2.0, partnerId: undefined },
      { id: '2', name: 'Bob', skillLevel: 2.5, partnerId: undefined },
      { id: '3', name: 'Charlie', skillLevel: 3.0, partnerId: undefined },
      { id: '4', name: 'Diana', skillLevel: 3.5, partnerId: undefined },
      { id: '5', name: 'Eve', skillLevel: 4.0, partnerId: undefined },
      { id: '6', name: 'Frank', skillLevel: 4.5, partnerId: undefined },
      { id: '7', name: 'Grace', skillLevel: 1.5, partnerId: undefined },
      { id: '8', name: 'Henry', skillLevel: 2.8, partnerId: undefined },
    ]

    defaultOptions = {
      numberOfCourts: 2,
      numberOfRounds: 7,
      balanceSkillLevels: true,
      respectPartnerPreferences: true,
      maxSkillDifference: 2.0,
      distributeRestEqually: true,
    }
  })

  describe('constructor', () => {
    it('should initialize with players and options', () => {
      const matcher = new PickleballMatcher(players, defaultOptions)
      expect(matcher).toBeDefined()
    })
  })

  describe('generateSchedule', () => {
    it('should generate a valid schedule with 7 rounds for 8 players', () => {
      const matcher = new PickleballMatcher(players, defaultOptions)
      const schedule = matcher.generateSchedule('Test Event')

      expect(schedule.rounds).toHaveLength(7)
      expect(schedule.rounds[0]).toHaveLength(2) // 2 courts for 8 players
      expect(schedule.eventLabel).toBe('Test Event')
      expect(schedule.options).toEqual(defaultOptions)
      expect(schedule.generatedAt).toBeInstanceOf(Date)
    })

    it('should handle fewer players than courts gracefully', () => {
      const matcher = new PickleballMatcher(players.slice(0, 6), defaultOptions)
      const schedule = matcher.generateSchedule()

      expect(schedule.rounds).toHaveLength(7)
      // Should have fewer courts when not enough players
      expect(schedule.rounds[0].length).toBeLessThanOrEqual(2)
    })

    it('should respect rest distribution when enabled', () => {
      const matcher = new PickleballMatcher(players, { ...defaultOptions, distributeRestEqually: true })
      const schedule = matcher.generateSchedule()

      // Count rest periods per player across all rounds
      const restCounts = new Map<string, number>()
      players.forEach(p => restCounts.set(p.id, 0))

      schedule.rounds.forEach((round, roundIndex) => {
        const playingPlayerIds = new Set<string>()
        round.forEach(game => {
          playingPlayerIds.add(game.team1[0])
          playingPlayerIds.add(game.team1[1])
          playingPlayerIds.add(game.team2[0])
          playingPlayerIds.add(game.team2[1])
        })

        players.forEach(player => {
          if (!playingPlayerIds.has(player.id)) {
            restCounts.set(player.id, (restCounts.get(player.id) || 0) + 1)
          }
        })
      })

      // Rest distribution should be relatively even
      const restValues = Array.from(restCounts.values())
      const maxRest = Math.max(...restValues)
      const minRest = Math.min(...restValues)
      expect(maxRest - minRest).toBeLessThanOrEqual(3) // Allow some variance for 8 players
    })
  })

  describe('partner preferences', () => {
    it('should respect partner preferences when enabled', () => {
      const partneredPlayers = [
        { id: '1', name: 'Alice', skillLevel: 2.0, partnerId: '2' },
        { id: '2', name: 'Bob', skillLevel: 2.5, partnerId: '1' },
        { id: '3', name: 'Charlie', skillLevel: 3.0, partnerId: '4' },
        { id: '4', name: 'Diana', skillLevel: 3.5, partnerId: '3' },
        { id: '5', name: 'Eve', skillLevel: 4.0, partnerId: undefined },
        { id: '6', name: 'Frank', skillLevel: 4.5, partnerId: undefined },
      ]

      const matcher = new PickleballMatcher(partneredPlayers, { ...defaultOptions, respectPartnerPreferences: true })
      const schedule = matcher.generateSchedule()

      // Check that partner preferences are mostly respected
      let partnerPairings = 0
      let totalPairings = 0

      schedule.rounds.forEach(round => {
        round.forEach(game => {
          totalPairings += 2 // Two teams per game

          // Check if Alice and Bob are partnered
          if ((game.team1[0] === '1' && game.team1[1] === '2') ||
              (game.team1[0] === '2' && game.team1[1] === '1') ||
              (game.team2[0] === '1' && game.team2[1] === '2') ||
              (game.team2[0] === '2' && game.team2[1] === '1')) {
            partnerPairings++
          }

          // Check if Charlie and Diana are partnered
          if ((game.team1[0] === '3' && game.team1[1] === '4') ||
              (game.team1[0] === '4' && game.team1[1] === '3') ||
              (game.team2[0] === '3' && game.team2[1] === '4') ||
              (game.team2[0] === '4' && game.team2[1] === '3')) {
            partnerPairings++
          }
        })
      })

      // Partner preferences should be respected in at least some cases
      expect(partnerPairings).toBeGreaterThan(0)
    })
  })
  describe('skill level balancing', () => {
    it('should balance skill levels when enabled', () => {
      const matcher = new PickleballMatcher(players, { ...defaultOptions, balanceSkillLevels: true, maxSkillDifference: 1.5 })
      const schedule = matcher.generateSchedule()

      // Check that skill differences between teams are reasonable
      schedule.rounds.forEach(round => {
        round.forEach(game => {
          // Game should have skillDifference property based on actual implementation
          if ('skillDifference' in game) {
            expect(game.skillDifference).toBeLessThanOrEqual(1.5)
          }
        })
      })
    })
  })

  describe('court assignment', () => {
    it('should assign courts correctly', () => {
      const matcher = new PickleballMatcher(players, defaultOptions)
      const schedule = matcher.generateSchedule()

      schedule.rounds.forEach(round => {
        round.forEach((game, index) => {
          expect(game.court).toBe(index + 1)
        })
      })
    })
  })

  describe('player validation', () => {
    it('should handle unique players correctly', () => {
      const matcher = new PickleballMatcher(players, defaultOptions)
      const schedule = matcher.generateSchedule()

      // Each round should have unique players (no player plays twice in same round)
      schedule.rounds.forEach(round => {
        const playersInRound = new Set<string>()
        round.forEach(game => {
          expect(playersInRound.has(game.team1[0])).toBe(false)
          expect(playersInRound.has(game.team1[1])).toBe(false)
          expect(playersInRound.has(game.team2[0])).toBe(false)
          expect(playersInRound.has(game.team2[1])).toBe(false)

          playersInRound.add(game.team1[0])
          playersInRound.add(game.team1[1])
          playersInRound.add(game.team2[0])
          playersInRound.add(game.team2[1])
        })
      })
    })
  })

  describe('edge cases', () => {
    it('should handle minimum number of players (4)', () => {
      const minPlayers = players.slice(0, 4)
      const minOptions = { ...defaultOptions, numberOfCourts: 1, numberOfRounds: 3 }
      const matcher = new PickleballMatcher(minPlayers, minOptions)
      const schedule = matcher.generateSchedule()

      expect(schedule.rounds).toHaveLength(3)
      expect(schedule.rounds[0]).toHaveLength(1) // Only 1 court for 4 players
    })

    it('should handle odd number of players', () => {
      const oddPlayers = players.slice(0, 7)
      const matcher = new PickleballMatcher(oddPlayers, defaultOptions)
      const schedule = matcher.generateSchedule()

      expect(schedule.rounds).toHaveLength(7)
      // Should still generate valid schedule with some players resting
      expect(schedule.restingPlayers).toHaveLength(7)
    })

    it('should handle zero rounds request', () => {
      const zeroRoundsOptions = { ...defaultOptions, numberOfRounds: 0 }
      const matcher = new PickleballMatcher(players, zeroRoundsOptions)
      const schedule = matcher.generateSchedule()

      expect(schedule.rounds).toHaveLength(0)
      expect(schedule.restingPlayers).toHaveLength(0)
    })
  })
})
