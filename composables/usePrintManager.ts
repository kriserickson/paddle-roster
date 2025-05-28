import type { GameSchedule, PrintOptions } from '~/types';

/**
 * Composable for printing game schedules
 */
export const usePrintManager = () => {
  const { getPlayer } = usePlayerManager();

  /**
   * Default print options
   */
  const defaultPrintOptions: PrintOptions = {
    eventTitle: '',
    eventSubtitle: '',
    includeStats: false,
    includeRestPeriods: true,
    orientation: 'landscape'
  };

  /**
   * Current print options
   */
  const printOptions = ref<PrintOptions>({ ...defaultPrintOptions });

  /**
   * Generate HTML content for printing
   */
  const generatePrintHTML = (schedule: GameSchedule, options: PrintOptions): string => {
    const playerName = (id: string): string => {
      return getPlayer(id)?.name || 'Unknown Player';
    };

    const formatSkillLevel = (level: number): string => {
      return level % 1 === 0 ? level.toString() : level.toFixed(2);
    };

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
            font-size: 11px;
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
            font-size: 18px;
            font-weight: bold;
        }
        
        .header h2 {
            margin: 5px 0 0 0;
            font-size: 14px;
            font-weight: normal;
            color: #666;
        }
        
        .schedule-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        .schedule-grid th,
        .schedule-grid td {
            border: 1px solid #333;
            padding: 4px;
            text-align: center;
            vertical-align: middle;
        }
        
        .schedule-grid th {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: 12px;
        }
        
        .round-header {
            font-weight: bold;
            background-color: #f8f8f8;
            font-size: 10px;
        }
        
        .game-cell {
            font-size: 9px;
            line-height: 1.1;
            min-height: 40px;
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
            font-size: 8px;
        }
        
        .skill-diff {
            font-size: 7px;
            color: #666;
            margin-top: 1px;
        }
        
        .rest-section {
            margin-top: 15px;
            font-size: 10px;
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
    if (options.eventTitle || options.eventSubtitle) {
      html += '<div class="header">';
      if (options.eventTitle) {
        html += `<h1>${options.eventTitle}</h1>`;
      }
      if (options.eventSubtitle) {
        html += `<h2>${options.eventSubtitle}</h2>`;
      }
      html += '</div>';
    }

    // Generate schedule grid
    html += '<table class="schedule-grid">';
    
    // Header row
    html += '<thead><tr><th>Round</th>';
    for (let court = 1; court <= schedule.options.numberOfCourts; court++) {
      html += `<th>Court ${court}</th>`;
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
      
      // Games for each court
      for (let court = 1; court <= schedule.options.numberOfCourts; court++) {
        const game = round.find(g => g.court === court);
        
        html += '<td class="game-cell">';
        if (game) {
          const team1Player1 = playerName(game.team1[0]);
          const team1Player2 = playerName(game.team1[1]);
          const team2Player1 = playerName(game.team2[0]);
          const team2Player2 = playerName(game.team2[1]);
          
          html += `<div class="team team1">${team1Player1}<br>${team1Player2}</div>`;
          html += '<div class="vs">vs</div>';
          html += `<div class="team team2">${team2Player1}<br>${team2Player2}</div>`;
          
          if (options.includeStats) {
            html += `<div class="skill-diff">Diff: ${formatSkillLevel(game.skillDifference)}</div>`;
          }
        }
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
  };

  /**
   * Generate statistics section for print
   */
  const generateStatsSection = (schedule: GameSchedule): string => {
    const totalGames = schedule.rounds.reduce((sum, round) => sum + round.length, 0);
    const allGames = schedule.rounds.flat();
    const avgSkillDiff = allGames.length > 0 
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
  };

  /**
   * Print the current schedule
   */
  const printSchedule = (schedule: GameSchedule, customOptions?: Partial<PrintOptions>): void => {
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
  };

  /**
   * Download schedule as HTML file
   */
  const downloadScheduleHTML = (schedule: GameSchedule, customOptions?: Partial<PrintOptions>): void => {
    const options = { ...printOptions.value, ...customOptions };
    const html = generatePrintHTML(schedule, options);
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pickleball-schedule-${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Update print options
   */
  const updatePrintOptions = (newOptions: Partial<PrintOptions>): void => {
    printOptions.value = { ...printOptions.value, ...newOptions };
  };

  /**
   * Reset print options to defaults
   */
  const resetPrintOptions = (): void => {
    printOptions.value = { ...defaultPrintOptions };
  };

  return {
    printOptions: readonly(printOptions),
    defaultPrintOptions,
    
    // Actions
    printSchedule,
    downloadScheduleHTML,
    updatePrintOptions,
    resetPrintOptions,
    generatePrintHTML
  };
};
