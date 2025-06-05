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
    compactLayout: false,
    orientation: 'landscape',
    colorMode: true,
    showRatings: true
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

    function getPlayerSkill(id: string): number {
      return playerStore.getPlayer(id)?.skillLevel || 0;
    }

    const colorStyles = options.colorMode ? `
        .team1 {
            background-color: #e8f4f8;
            border: 1px solid #b8d4da;
        }
        
        .team2 {
            background-color: #f8e8e8;
            border: 1px solid #dab8b8;
        }
        
        .round-header {
            background-color: #f8f8f8;
        }
        
        .schedule-grid th {
            background-color: #f0f0f0;
        }
    ` : `
        .team2 {
            background: #ccc;
            border: none;
            padding: 2px 0;
        }
        
        .round-header {
            background: transparent;
        }
        
        .schedule-grid th {
            background: transparent;
        }
        
        .rest-players {
            background: transparent;
            border: none !important;
            padding: 5px 0;
        }
        
        .game-cell {
            border: none;
        }
        
    `;

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
            font-weight: bold;
            font-size: ${options.compactLayout ? '10px' : '13px'};
        }
        
        .round-header {
            font-weight: bold;
            font-size: ${options.compactLayout ? '10px' : '13px'};
        }
        
        .game-cell {
            font-size: ${options.compactLayout ? '10px' : '13px'};
            line-height: 1.1;
            min-height: ${options.compactLayout ? '30px' : '40px'};
        }

        .game-holder {
            height: 75px;
            display: flex;
            flex-direction: column;    
        }
        
        .team {
            margin: 1px 0;
            padding: 1px 2px;
            border-radius: 2px;
            font-size: ${options.compactLayout ? '11px' : '13px'};            
            flex: 1; 
            align-content: center;
        }
        
        ${colorStyles}
        
        .team-divider {
            border-top: 1px solid #333;
            margin: 2px 0;
        }
        
        .rest-players {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: ${options.compactLayout ? '11px' : '13px'};            
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

    // Event info - compact layout puts everything on one line
    if (options.eventDate || options.location || options.organizer) {
      html += '<div class="event-info">';
      if (options.compactLayout) {
        // All on one line
        const eventParts = [];
        if (options.eventDate) eventParts.push(`Date: ${options.eventDate}`);
        if (options.location) eventParts.push(`Location: ${options.location}`);
        if (options.organizer) eventParts.push(`Organizer: ${options.organizer}`);
        html += eventParts.join(' • ');
      } else {
        // Separate lines
        if (options.eventDate) {
          html += `<div>Date: ${options.eventDate}</div>`;
        }
        if (options.location) {
          html += `<div>Location: ${options.location}</div>`;
        }
        if (options.organizer) {
          html += `<div>Organizer: ${options.organizer}</div>`;
        }
      }
      html += '</div>';
    }
    html += '</div>';

    // Generate schedule grid
    html += '<table class="schedule-grid">';

    // Header row
    html += '<thead><tr><th>Round</th>';
    for (let court = 1; court <= schedule.options.numberOfCourts; court++) {
      html += `<th>Court ${court}</th>`;
    }
    html += '<th>Resting</th>';
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
          html += generateGameHTML(game, playerName, formatSkillLevel, getPlayerSkill, options);
        }
        html += '</td>';
      }

      // Resting players
      html += '<td class="game-cell">';
      if (restingPlayers.length > 0) {
        const restingNames = restingPlayers.map(id => playerName(id)).join('<br>');
        html += `<div class="rest-players">${restingNames}</div>`;
      } else {
        html += '-';
      }
      html += '</td>';

      html += '</tr>';
    }

    html += '</tbody></table></body></html>';

    return html;
  }

  function generateGameHTML(
    game: Game,
    playerName: (id: string) => string,
    formatSkillLevel: (level: number) => string,
    getPlayerSkill: (id: string) => number,
    options: PrintOptions
  ): string {
    const team1Player1 = playerName(game.team1[0]);
    const team1Player2 = playerName(game.team1[1]);
    const team2Player1 = playerName(game.team2[0]);
    const team2Player2 = playerName(game.team2[1]);

    let html = '<div class="game-holder">';

    if (options.compactLayout) {
      // Compact layout: players on same line with &, line divider instead of "vs"
      html += `<div class="team team1">`;


      
      if (options.showRatings) {
        const skill1 = getPlayerSkill(game.team1[0]);
        const skill2 = getPlayerSkill(game.team1[1]);
        html += `${team1Player1} (${formatSkillLevel(skill1)}) & ${team1Player2} (${formatSkillLevel(skill2)})`;
      } else {
        html += `${team1Player1} & ${team1Player2}`;
      }
      html += '</div>';
      
      
      html += `<div class="team team2">`;
      if (options.showRatings) {
        const skill1 = getPlayerSkill(game.team2[0]);
        const skill2 = getPlayerSkill(game.team2[1]);
        html += `${team2Player1} (${formatSkillLevel(skill1)}) & ${team2Player2} (${formatSkillLevel(skill2)})`;
      } else {
        html += `${team2Player1} & ${team2Player2}`;
      }
      html += '</div>';
    } else {
      // Standard layout: separate lines for each player, "vs" divider
      html += `<div class="team team1">`;
      if (options.showRatings) {
        const skill1 = getPlayerSkill(game.team1[0]);
        const skill2 = getPlayerSkill(game.team1[1]);
        html += `${team1Player1} (${formatSkillLevel(skill1)}) <br>${team1Player2} (${formatSkillLevel(skill2)})`;
      } else {
        html += `${team1Player1}<br>${team1Player2}`;
      }
      html += '</div>';
      
      html += '<div style="font-weight: bold; margin: 2px 0; font-size: ' + 
              (options.compactLayout ? '7px' : '8px') + ';">vs</div>';
      
      html += `<div class="team team2">`;
      if (options.showRatings) {
        const skill1 = getPlayerSkill(game.team2[0]);
        const skill2 = getPlayerSkill(game.team2[1]);
        html += `${team2Player1} (${formatSkillLevel(skill1)}) <br>${team2Player2} (${formatSkillLevel(skill2)})`;
      } else {
        html += `${team2Player1}<br>${team2Player2}`;
      }
      html += '</div>';
    }

    html += '</div>';

    return html;
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
