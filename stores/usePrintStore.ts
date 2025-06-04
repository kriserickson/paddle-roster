import { defineStore } from 'pinia';
import type { Game, GameSchedule, PrintOptions } from '~/types';

export const usePrintStore = defineStore('print', () => {
  /**
   * Default print options
   */
  const defaultPrintOptions: PrintOptions = {
    eventTitle: '',
    eventSubtitle: '',
    eventDate: '',
    location: '',
    organizer: '',
    includeStats: false,
    includeRestPeriods: true,
    includeCourtAssignments: true,
    compactLayout: false,
    orientation: 'landscape'
  };

  /**
   * State
   */
  const printOptions = ref<PrintOptions>({ ...defaultPrintOptions });

  /**
   * Actions
   */
  function generatePrintHTML(schedule: GameSchedule, options: PrintOptions): string {
    const playerStore = usePlayerStore();

    function playerName(id: string): string {
      return playerStore.getPlayer(id)?.name || 'Unknown Player';
    }

    function formatSkillLevel(level: number): string {
      return level % 1 === 0 ? level.toString() : level.toFixed(2);
    }

    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${options.eventTitle || 'Pickleball Schedule'}</title>
    <style>
        @page {
            size: ${options.orientation};
            margin: 0.5in;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: ${options.compactLayout ? '10px' : '11px'};
            line-height: 1.2;
            margin: 0;
            padding: 0;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        
        .header h1 {
            margin: 0;
            font-size: ${options.compactLayout ? '16px' : '18px'};
            font-weight: bold;
        }
        
        .header h2 {
            margin: 5px 0 0 0;
            font-size: ${options.compactLayout ? '12px' : '14px'};
            font-weight: normal;
            color: #666;
        }
        
        .header .event-info {
            margin: 5px 0;
            font-size: ${options.compactLayout ? '10px' : '12px'};
            color: #555;
        }
        
        .schedule-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .schedule-grid th,
        .schedule-grid td {
            border: 1px solid #333;
            padding: ${options.compactLayout ? '2px' : '4px'};
            text-align: center;
            vertical-align: middle;
        }
        
        .schedule-grid th {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: ${options.compactLayout ? '10px' : '12px'};
        }
        
        .round-header {
            font-weight: bold;
            background-color: #f8f8f8;
            font-size: ${options.compactLayout ? '9px' : '10px'};
        }
        
        .game-cell {
            font-size: ${options.compactLayout ? '8px' : '9px'};
            line-height: 1.1;
            min-height: ${options.compactLayout ? '30px' : '40px'};
        }
        
        .team {
            margin: 1px 0;
            padding: 1px 2px;
            border-radius: 2px;
        }
        
        .team1 {
            background-color: #e8f4f8;
            border: 1px solid #b8d4da;
        }
        
        .team2 {
            background-color: #f8e8e8;
            border: 1px solid #dab8b8;
        }
        
        .vs {
            font-weight: bold;
            margin: 2px 0;
            font-size: ${options.compactLayout ? '7px' : '8px'};
        }
        
        .skill-diff {
            font-size: ${options.compactLayout ? '6px' : '7px'};
            color: #666;
            margin-top: 1px;
        }
        
        .rest-section {
            margin-top: 15px;
            font-size: ${options.compactLayout ? '9px' : '10px'};
        }
        
        .rest-players {
            background-color: #fff8dc;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 3px;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; }
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
    `;

    // Header
    html += '<div class="header">';
    if (options.eventTitle) {
      html += `<h1>${options.eventTitle}</h1>`;
    }
    if (options.eventSubtitle) {
      html += `<h2>${options.eventSubtitle}</h2>`;
    }

    // Event info
    if (options.eventDate || options.location || options.organizer) {
      html += '<div class="event-info">';
      if (options.eventDate) {
        html += `<div>Date: ${options.eventDate}</div>`;
      }
      if (options.location) {
        html += `<div>Location: ${options.location}</div>`;
      }
      if (options.organizer) {
        html += `<div>Organizer: ${options.organizer}</div>`;
      }
      html += '</div>';
    }
    html += '</div>';

    // Generate schedule grid
    html += '<table class="schedule-grid">';

    // Header row
    html += '<thead><tr><th>Round</th>';
    if (options.includeCourtAssignments) {
      for (let court = 1; court <= schedule.options.numberOfCourts; court++) {
        html += `<th>Court ${court}</th>`;
      }
    } else {
      html += '<th>Games</th>';
    }
    if (options.includeRestPeriods) {
      html += '<th>Resting</th>';
    }
    html += '</tr></thead><tbody>';

    // Data rows
    for (let roundIndex = 0; roundIndex < schedule.rounds.length; roundIndex++) {
      const round = schedule.rounds[roundIndex];
      const restingPlayers = schedule.restingPlayers[roundIndex];

      html += `<tr><td class="round-header">Round ${roundIndex + 1}</td>`;

      if (options.includeCourtAssignments) {
        // Games for each court
        for (let court = 1; court <= schedule.options.numberOfCourts; court++) {
          const game = round.find(g => g.court === court);

          html += '<td class="game-cell">';
          if (game) {
            html += generateGameHTML(game, playerName, formatSkillLevel, options);
          }
          html += '</td>';
        }
      } else {
        // All games in one column
        html += '<td class="game-cell">';
        round.forEach((game, index) => {
          if (index > 0) html += '<br><br>';
          html += generateGameHTML(game, playerName, formatSkillLevel, options);
        });
        html += '</td>';
      }

      // Resting players
      if (options.includeRestPeriods) {
        html += '<td class="game-cell">';
        if (restingPlayers.length > 0) {
          const restingNames = restingPlayers.map(id => playerName(id)).join('<br>');
          html += restingNames;
        } else {
          html += '-';
        }
        html += '</td>';
      }

      html += '</tr>';
    }

    html += '</tbody></table>';

    // Stats section
    if (options.includeStats) {
      html += generateStatsSection(schedule);
    }

    html += `
    <div style="margin-top: 20px; font-size: 8px; color: #666; text-align: center;">
        Generated: ${schedule.generatedAt.toLocaleString()}
    </div>
</body>
</html>`;

    return html;
  }

  function generateGameHTML(
    game: Game,
    playerName: (id: string) => string,
    formatSkillLevel: (level: number) => string,
    options: PrintOptions
  ): string {
    const team1Player1 = playerName(game.team1[0]);
    const team1Player2 = playerName(game.team1[1]);
    const team2Player1 = playerName(game.team2[0]);
    const team2Player2 = playerName(game.team2[1]);

    let html = `<div class="team team1">${team1Player1}<br>${team1Player2}</div>`;
    html += '<div class="vs">vs</div>';
    html += `<div class="team team2">${team2Player1}<br>${team2Player2}</div>`;

    if (options.includeStats) {
      html += `<div class="skill-diff">Diff: ${formatSkillLevel(game.skillDifference)}</div>`;
    }

    return html;
  }

  function generateStatsSection(schedule: GameSchedule): string {
    const totalGames = schedule.rounds.reduce((sum, round) => sum + round.length, 0);
    const allGames = schedule.rounds.flat();
    const avgSkillDiff =
      allGames.length > 0
        ? (allGames.reduce((sum, game) => sum + game.skillDifference, 0) / allGames.length).toFixed(2)
        : '0';

    return `
    <div style="margin-top: 20px; font-size: 10px; border-top: 1px solid #ccc; padding-top: 10px;">
        <h3 style="margin: 0 0 10px 0; font-size: 12px;">Schedule Statistics</h3>
        <div style="display: flex; justify-content: space-around;">
            <div>Total Rounds: ${schedule.rounds.length}</div>
            <div>Total Games: ${totalGames}</div>
            <div>Courts Used: ${schedule.options.numberOfCourts}</div>
            <div>Avg Skill Difference: ${avgSkillDiff}</div>
        </div>
    </div>`;
  }

  function printSchedule(schedule: GameSchedule, customOptions?: Partial<PrintOptions>): void {
    const options = { ...printOptions.value, ...customOptions };
    const html = generatePrintHTML(schedule, options);

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
    } else {
      // Fallback: create a blob and open it
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pickleball-schedule-${new Date().toISOString().split('T')[0]}.html`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  function downloadScheduleHTML(schedule: GameSchedule, customOptions?: Partial<PrintOptions>): void {
    const options = { ...printOptions.value, ...customOptions };
    const html = generatePrintHTML(schedule, options);

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pickleball-schedule-${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updatePrintOptions(newOptions: Partial<PrintOptions>): void {
    printOptions.value = { ...printOptions.value, ...newOptions };
  }

  function resetPrintOptions(): void {
    printOptions.value = { ...defaultPrintOptions };
  }

  return {
    // State
    printOptions: readonly(printOptions),
    defaultPrintOptions,

    // Actions
    printSchedule,
    downloadScheduleHTML,
    updatePrintOptions,
    resetPrintOptions,
    generatePrintHTML
  };
});
