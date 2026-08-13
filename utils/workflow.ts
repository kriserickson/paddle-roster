const DEFAULT_SCHEDULE_STEP_PLAYER_THRESHOLD = 8;

export type WorkflowTabKey = 'players' | 'games' | 'schedule';

const WORKFLOW_TAB_KEYS: WorkflowTabKey[] = ['players', 'games', 'schedule'];

export function getInitialWorkflowTab(tabParam: unknown, playerCount: number): WorkflowTabKey {
  if (typeof tabParam === 'string' && WORKFLOW_TAB_KEYS.includes(tabParam as WorkflowTabKey)) {
    return tabParam as WorkflowTabKey;
  }

  return playerCount > DEFAULT_SCHEDULE_STEP_PLAYER_THRESHOLD ? 'games' : 'players';
}
