import { describe, expect, it } from 'vitest';
import { getInitialWorkflowTab } from '~/utils/workflow';

describe('getInitialWorkflowTab', () => {
  it('opens the player step for eight or fewer loaded players', () => {
    expect(getInitialWorkflowTab(undefined, 8)).toBe('players');
  });

  it('opens the schedule builder for more than eight loaded players', () => {
    expect(getInitialWorkflowTab(undefined, 9)).toBe('games');
  });

  it('honors a valid tab URL parameter', () => {
    expect(getInitialWorkflowTab('players', 12)).toBe('players');
    expect(getInitialWorkflowTab('schedule', 12)).toBe('schedule');
  });

  it('uses the player count when the tab URL parameter is invalid', () => {
    expect(getInitialWorkflowTab('unknown', 12)).toBe('games');
  });
});
