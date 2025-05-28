<script setup lang="ts">
import type { GameSchedule, PrintOptions } from '~/types';

interface Props {
  schedule: GameSchedule;
  options: PrintOptions;
}

const props = defineProps<Props>();
const playerStore = usePlayerStore();

/**
 * Get player name safely
 */
const getPlayerName = (id: string): string => {
  return playerStore.getPlayer(id)?.name || 'Unknown Player';
};

/**
 * Format skill level safely
 */
const formatSkillLevel = (level: number): string => {
  return level % 1 === 0 ? level.toString() : level.toFixed(2);
};

/**
 * Get current date formatted
 */
const getCurrentDate = (): string => {
  return new Date().toLocaleDateString();
};

/**
 * Calculate total games per player
 */
const getPlayerGameCount = (playerId: string): number => {
  let count = 0;
  props.schedule.rounds.forEach(round => {
    round.forEach(game => {
      if (game.team1[0] === playerId || 
          game.team1[1] === playerId || 
          game.team2[0] === playerId || 
          game.team2[1] === playerId) {
        count++;
      }
    });
  });
  return count;
};

/**
 * Get players sitting out in a round
 */
const getPlayersRestingInRound = (roundIndex: number): string[] => {
  return props.schedule.restingPlayers[roundIndex] || [];
};

/**
 * Get all unique players from the schedule
 */
const getAllPlayers = computed(() => {
  const playerIds = new Set<string>();
  props.schedule.rounds.forEach(round => {
    round.forEach(game => {
      playerIds.add(game.team1[0]);
      playerIds.add(game.team1[1]);
      playerIds.add(game.team2[0]);
      playerIds.add(game.team2[1]);
    });
  });
  props.schedule.restingPlayers.forEach(restingRound => {
    restingRound.forEach(playerId => {
      playerIds.add(playerId);
    });
  });
    return Array.from(playerIds)
    .map(id => playerStore.getPlayer(id))
    .filter((player): player is NonNullable<typeof player> => player !== undefined);
});
</script>

<template>
  <div class="print-preview-safe">
    <!-- Header -->
    <div class="header">
      <h1>{{ props.options.eventTitle || 'Pickleball Schedule' }}</h1>
      <div class="event-details">
        <div v-if="props.options.eventDate" class="event-date">
          Date: {{ new Date(props.options.eventDate).toLocaleDateString() }}
        </div>
        <div v-if="props.options.location" class="event-location">
          Location: {{ props.options.location }}
        </div>
        <div v-if="props.options.organizer" class="event-organizer">
          Organizer: {{ props.options.organizer }}
        </div>
      </div>
    </div>    <!-- Player List -->
    <div v-if="props.options.includePlayerList" class="section">
      <h2>Players</h2>
      <div class="player-list">
        <div
          v-for="player in getAllPlayers"
          :key="player.id"
          class="player-item"
        >
          {{ player.name }} ({{ formatSkillLevel(player.skillLevel) }})
        </div>
      </div>
    </div>

    <!-- Rounds -->
    <div class="rounds-section">
      <div
        v-for="(round, roundIndex) in props.schedule.rounds"
        :key="roundIndex"
        class="round-section"
      >
        <h2>Round {{ roundIndex + 1 }}</h2>
        
        <!-- Games -->
        <div class="games-grid">
          <div
            v-for="game in round"
            :key="`${roundIndex}-${game.court}`"
            class="game-card"
          >
            <div class="court-header">
              <span v-if="props.options.includeCourtAssignments">
                Court {{ game.court }}
              </span>
            </div>
            <div class="teams">
              <div class="team">
                <span class="team-label">Team 1:</span>
                {{ getPlayerName(game.team1[0]) }} & {{ getPlayerName(game.team1[1]) }}                <div class="skill-levels">
                  ({{ formatSkillLevel(playerStore.getPlayer(game.team1[0])?.skillLevel || 0) }}, 
                   {{ formatSkillLevel(playerStore.getPlayer(game.team1[1])?.skillLevel || 0) }})
                </div>
              </div>
              <div class="vs">vs</div>
              <div class="team">
                <span class="team-label">Team 2:</span>
                {{ getPlayerName(game.team2[0]) }} & {{ getPlayerName(game.team2[1]) }}                <div class="skill-levels">
                  ({{ formatSkillLevel(playerStore.getPlayer(game.team2[0])?.skillLevel || 0) }}, 
                   {{ formatSkillLevel(playerStore.getPlayer(game.team2[1])?.skillLevel || 0) }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rest Period Info -->
        <div 
          v-if="props.options.includeRestPeriods && getPlayersRestingInRound(roundIndex).length > 0"
          class="rest-info"
        >
          <strong>Resting this round:</strong>
          <span
            v-for="(playerId, index) in getPlayersRestingInRound(roundIndex)"
            :key="playerId"
          >
            {{ getPlayerName(playerId) }}{{ index < getPlayersRestingInRound(roundIndex).length - 1 ? ', ' : '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div v-if="props.options.includeStats" class="section">
      <h2>Game Statistics</h2>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Skill Level</th>
            <th>Games Played</th>
            <th>Rest Periods</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="player in getAllPlayers"
            :key="player.id"
          >
            <td>{{ player.name }}</td>
            <td>{{ formatSkillLevel(player.skillLevel) }}</td>
            <td>{{ getPlayerGameCount(player.id) }}</td>
            <td>{{ props.schedule.rounds.length - getPlayerGameCount(player.id) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="generated-info">
        Schedule generated on {{ getCurrentDate() }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.print-preview-safe {
  font-family: 'Times New Roman', serif;
  line-height: 1.4;
  color: #000;
  background: white;
  padding: 20px;
  min-height: 400px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 2px solid #000;
  padding-bottom: 20px;
}

.header h1 {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 16px 0;
}

.event-details {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 14px;
}

.section {
  margin-bottom: 30px;
}

.section h2 {
  font-size: 18px;
  font-weight: bold;
  margin: 16px 0 12px 0;
  border-bottom: 1px solid #ccc;
  padding-bottom: 4px;
}

.player-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.player-item {
  padding: 4px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
}

.rounds-section {
  margin-bottom: 30px;
}

.round-section {
  margin-bottom: 40px;
  page-break-inside: avoid;
}

.round-section h2 {
  font-size: 18px;
  font-weight: bold;
  margin: 20px 0 12px 0;
  color: #333;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.game-card {
  border: 1px solid #ddd;
  padding: 12px;
  border-radius: 6px;
  background-color: #fafafa;
}

.court-header {
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
  color: #666;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team {
  text-align: center;
}

.team-label {
  font-weight: bold;
  display: block;
  margin-bottom: 2px;
}

.skill-levels {
  font-size: 10px;
  color: #666;
  margin-top: 2px;
}

.vs {
  text-align: center;
  font-weight: bold;
  color: #888;
  margin: 4px 0;
}

.rest-info {
  background-color: #f0f8ff;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 12px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.stats-table th,
.stats-table td {
  border: 1px solid #ccc;
  padding: 6px 8px;
  text-align: left;
}

.stats-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.footer {
  margin-top: 40px;
  text-align: center;
  border-top: 1px solid #ccc;
  padding-top: 16px;
}

.generated-info {
  font-size: 10px;
  color: #666;
  margin: 0;
}

/* Compact layout */
.print-preview-safe.compact .game-card {
  padding: 8px;
}

.print-preview-safe.compact .teams {
  gap: 4px;
}

.print-preview-safe.compact .section {
  margin-bottom: 20px;
}

/* Print styles */
@media print {
  .print-preview-safe {
    padding: 0;
  }
  
  .round-section {
    page-break-inside: avoid;
  }
  
  .game-card {
    break-inside: avoid;
  }
}
</style>
