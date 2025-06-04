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
function getPlayerName(id: string): string {
  return playerStore.getPlayer(id)?.name || 'Unknown Player';
}

/**
 * Format skill level safely
 */
function formatSkillLevel(level: number): string {
  return level % 1 === 0 ? level.toString() : level.toFixed(2);
}

/**
 * Get current date formatted
 */
function getCurrentDate(): string {
  return new Date().toLocaleDateString();
}

/**
 * Calculate total games per player
 */
function getPlayerGameCount(playerId: string): number {
  let count = 0;
  props.schedule.rounds.forEach(round => {
    round.forEach(game => {
      if (
        game.team1[0] === playerId ||
        game.team1[1] === playerId ||
        game.team2[0] === playerId ||
        game.team2[1] === playerId
      ) {
        count++;
      }
    });
  });
  return count;
}

/**
 * Get players sitting out in a round
 */
function getPlayersRestingInRound(roundIndex: number): string[] {
  return props.schedule.restingPlayers[roundIndex] || [];
}

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
  <!-- Print simulation wrapper with actual print dimensions -->
  <div class="print-page-wrapper" :class="{ landscape: props.options.orientation === 'landscape' }">
    <div class="print-preview-safe">
      <!-- Header -->
      <div class="header">
        <h1>{{ props.options.eventTitle || 'Pickleball Schedule' }}</h1>
        <div class="event-details">
          <div v-if="props.options.eventDate" class="event-date">
            Date: {{ new Date(props.options.eventDate).toLocaleDateString() }}
          </div>
          <div v-if="props.options.location" class="event-location">Location: {{ props.options.location }}</div>
          <div v-if="props.options.organizer" class="event-organizer">Organizer: {{ props.options.organizer }}</div>
        </div>
      </div>
      <!-- Player List -->
      <div v-if="props.options.includePlayerList" class="section">
        <h2>Players</h2>
        <div class="player-list">
          <div v-for="player in getAllPlayers" :key="player.id" class="player-item">
            {{ player.name }} ({{ formatSkillLevel(player.skillLevel) }})
          </div>
        </div>
      </div>

      <!-- Rounds -->
      <div class="rounds-section">
        <div v-for="(round, roundIndex) in props.schedule.rounds" :key="roundIndex" class="round-section">
          <h2>Round {{ roundIndex + 1 }}</h2>

          <!-- Games -->
          <div class="games-grid">
            <div v-for="game in round" :key="`${roundIndex}-${game.court}`" class="game-card">
              <div class="court-header">
                <span v-if="props.options.includeCourtAssignments"> Court {{ game.court }} </span>
              </div>
              <div class="teams">
                <div class="team">
                  <span class="team-label">Team 1:</span>
                  {{ getPlayerName(game.team1[0]) }} & {{ getPlayerName(game.team1[1]) }}
                  <div class="skill-levels">
                    ({{ formatSkillLevel(playerStore.getPlayer(game.team1[0])?.skillLevel || 0) }},
                    {{ formatSkillLevel(playerStore.getPlayer(game.team1[1])?.skillLevel || 0) }})
                  </div>
                </div>
                <div class="vs">vs</div>
                <div class="team">
                  <span class="team-label">Team 2:</span>
                  {{ getPlayerName(game.team2[0]) }} & {{ getPlayerName(game.team2[1]) }}
                  <div class="skill-levels">
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
            <span v-for="(playerId, index) in getPlayersRestingInRound(roundIndex)" :key="playerId">
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
            <tr v-for="player in getAllPlayers" :key="player.id">
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
        <p class="generated-info">Schedule generated on {{ getCurrentDate() }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Print page simulation wrapper */
.print-page-wrapper {
  /* Simulate 8.5" x 11" paper with proper scaling */
  width: 816px; /* 8.5 inches at 96 DPI */
  min-height: 1056px; /* 11 inches at 96 DPI */
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
  overflow: hidden;
  /* Add print margins simulation */
  padding: 72px; /* 0.75 inches at 96 DPI */
  box-sizing: border-box;
}

/* Landscape orientation simulation */
.print-page-wrapper.landscape {
  width: 1056px; /* 11 inches at 96 DPI */
  min-height: 816px; /* 8.5 inches at 96 DPI */
}

.print-preview-safe {
  font-family: 'Times New Roman', serif;
  font-size: 12pt;
  line-height: 1.4;
  color: #000;
  background: transparent;
  width: 100%;
  height: 100%;
  overflow: visible;
  box-sizing: border-box;
  /* Force print layout styles in preview */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.header {
  text-align: center;
  margin-bottom: 24pt;
  border-bottom: 2pt solid #000;
  padding-bottom: 16pt;
}

.header h1 {
  font-size: 20pt;
  font-weight: bold;
  margin: 0 0 12pt 0;
}

.event-details {
  display: flex;
  justify-content: center;
  gap: 16pt;
  flex-wrap: wrap;
  font-size: 11pt;
}

.section {
  margin-bottom: 24pt;
  /* Apply print break rules directly */
  break-inside: avoid;
  page-break-inside: avoid;
}

.section h2 {
  font-size: 16pt;
  font-weight: bold;
  margin: 12pt 0 8pt 0;
  border-bottom: 1pt solid #ccc;
  padding-bottom: 3pt;
}

.player-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180pt, 1fr));
  gap: 6pt;
  margin-bottom: 12pt;
}

.player-item {
  padding: 3pt 6pt;
  background-color: #f5f5f5;
  border-radius: 3pt;
  font-size: 10pt;
}

.rounds-section {
  margin-bottom: 24pt;
}

.round-section {
  margin-bottom: 32pt;
  /* Apply print break rules directly */
  break-inside: avoid;
  page-break-inside: avoid;
}

.round-section h2 {
  font-size: 16pt;
  font-weight: bold;
  margin: 16pt 0 10pt 0;
  color: #333;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280pt, 1fr));
  gap: 10pt;
  margin-bottom: 12pt;
}

.game-card {
  border: 1pt solid #ddd;
  padding: 10pt;
  border-radius: 4pt;
  background-color: #fafafa;
  /* Apply print break rules directly */
  break-inside: avoid;
  page-break-inside: avoid;
}

.court-header {
  font-weight: bold;
  margin-bottom: 6pt;
  text-align: center;
  color: #666;
  font-size: 11pt;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 6pt;
}

.team {
  text-align: center;
  font-size: 11pt;
}

.team-label {
  font-weight: bold;
  display: block;
  margin-bottom: 2pt;
}

.skill-levels {
  font-size: 9pt;
  color: #666;
  margin-top: 1pt;
}

.vs {
  text-align: center;
  font-weight: bold;
  color: #888;
  margin: 3pt 0;
  font-size: 10pt;
}

.rest-info {
  background-color: #f0f8ff;
  padding: 6pt 10pt;
  border-radius: 3pt;
  font-size: 10pt;
  margin-top: 10pt;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
}

.stats-table th,
.stats-table td {
  border: 1pt solid #ccc;
  padding: 4pt 6pt;
  text-align: left;
}

.stats-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.footer {
  margin-top: 32pt;
  text-align: center;
  border-top: 1pt solid #ccc;
  padding-top: 12pt;
}

.generated-info {
  font-size: 9pt;
  color: #666;
  margin: 0;
}

/* Compact layout - reduce spacing and sizes */
.print-preview-safe.compact .game-card {
  padding: 6pt;
}

.print-preview-safe.compact .teams {
  gap: 3pt;
}

.print-preview-safe.compact .section {
  margin-bottom: 16pt;
}

.print-preview-safe.compact .round-section {
  margin-bottom: 24pt;
}

.print-preview-safe.compact .games-grid {
  grid-template-columns: repeat(auto-fit, minmax(240pt, 1fr));
  gap: 6pt;
}

.print-preview-safe.compact .header {
  margin-bottom: 16pt;
  padding-bottom: 12pt;
}

.print-preview-safe.compact .header h1 {
  font-size: 18pt;
  margin-bottom: 10pt;
}

.print-preview-safe.compact .section h2 {
  font-size: 14pt;
  margin: 10pt 0 6pt 0;
}

.print-preview-safe.compact .round-section h2 {
  font-size: 14pt;
  margin: 12pt 0 8pt 0;
}

/* Print styles - must match the preview exactly */
@media print {
  /* Reset everything to match preview */
  .print-page-wrapper {
    width: 100% !important;
    min-height: 100% !important;
    margin: 0 !important;
    padding: 0.75in !important; /* Match the 72px padding from preview */
    box-shadow: none !important;
    background: white !important;
    box-sizing: border-box !important;
  }

  .print-preview-safe {
    padding: 0 !important;
    font-size: 12pt !important;
    margin: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: 'Times New Roman', serif !important;
    line-height: 1.4 !important;
    color: #000 !important;
  }

  .round-section {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-bottom: 32pt !important;
  }

  .game-card {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    border: 1pt solid #ddd !important;
    background-color: #fafafa !important;
    padding: 10pt !important;
    border-radius: 4pt !important;
  }

  .section {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-bottom: 24pt !important;
  }

  .header {
    text-align: center !important;
    margin-bottom: 24pt !important;
    border-bottom: 2pt solid #000 !important;
    padding-bottom: 16pt !important;
  }

  .header h1 {
    font-size: 20pt !important;
    font-weight: bold !important;
    margin: 0 0 12pt 0 !important;
  }

  .games-grid {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(280pt, 1fr)) !important;
    gap: 10pt !important;
    margin-bottom: 12pt !important;
  }

  .section h2 {
    font-size: 16pt !important;
    font-weight: bold !important;
    margin: 12pt 0 8pt 0 !important;
    border-bottom: 1pt solid #ccc !important;
    padding-bottom: 3pt !important;
  }

  .round-section h2 {
    font-size: 16pt !important;
    font-weight: bold !important;
    margin: 16pt 0 10pt 0 !important;
    color: #333 !important;
  }

  /* Ensure colors and backgrounds print correctly */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
